/**
 * dispatch-one-time-* EventBridge 규칙 상태 점검.
 *
 * 배차 시스템이 driver-runnstatus-cron-{production,dev} Lambda를 특정 시각에
 * 딱 한 번 호출하도록 만드는 EventBridge 규칙(cron에 year까지 고정)을 대상으로 한다.
 * 발동 후에도 자동으로 disable/delete 되지 않는 classic Rule이라, 예정 시각이 지났는데도
 * State: ENABLED로 계속 남는다 — 실제로 발동했는지는 CloudWatch Invocations로만 확인 가능.
 *
 * `pnpm dispatch:rules` (src/scripts/dispatchRulesStatus.ts) 와 `GET /infra/dispatch-rules`
 * (server.ts) 둘 다 이 모듈의 getDispatchRulesStatus 를 공유한다.
 *
 * 조사 배경: llm-wiki/aws-pending.md 참조 (2026-08-17 수동 조사에서 9개 중 3개가
 * 예정 시각과 어긋나 있는 걸 발견, 그 중 2개만 실제 발동 확인됨).
 */

import {
  EventBridgeClient,
  ListRulesCommand,
  ListTargetsByRuleCommand,
  type Rule,
  type Target,
} from "@aws-sdk/client-eventbridge";
import { CloudWatchClient, GetMetricStatisticsCommand } from "@aws-sdk/client-cloudwatch";
import type { DispatchRuleReport, DispatchRuleStatus } from "../types";

const REGION = process.env.AWS_REGION || "ap-northeast-2";
export const DEFAULT_DISPATCH_RULE_PREFIX = "dispatch-one-time";

const eventBridge = new EventBridgeClient({ region: REGION });
const cloudWatch = new CloudWatchClient({ region: REGION });

// ──────────────── 규칙 이름 파싱 ────────────────
// 형식: dispatch-one-time-<YYYY-MM-DD>-<dispatchId>-<randomId>[-test]
interface ParsedName {
  namedDate: string; // 규칙 이름에 박힌 날짜 (보통 KST 발동일)
  dispatchId: string;
  isTest: boolean;
}

function parseRuleName(name: string): ParsedName | null {
  const m = name.match(/^dispatch-one-time-(\d{4}-\d{2}-\d{2})-(\d+)-.+$/);
  if (!m) return null;
  return {
    namedDate: m[1],
    dispatchId: m[2],
    isTest: name.endsWith("-test"),
  };
}

// ──────────────── cron 표현식 → 발동 시각 ────────────────
// EventBridge one-time cron: cron(Minutes Hours Day-of-month Month ? Year)
// 필드가 전부 고정 정수일 때만 파싱 (범위/리스트/와일드카드가 섞이면 null)
function parseCronFireTime(scheduleExpression: string | undefined): Date | null {
  if (!scheduleExpression) return null;
  const m = scheduleExpression.match(/^cron\((\d+) (\d+) (\d+) (\d+) \S+ (\d+)\)$/);
  if (!m) return null;
  const [, min, hour, day, month, year] = m;
  const d = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(min))
  );
  return Number.isNaN(d.getTime()) ? null : d;
}

// ──────────────── target Input 파싱 ────────────────
interface DispatchInput {
  date?: string;
  action?: string;
  driverName?: string;
  statusId?: string;
}

function parseTargetInput(target: Target | undefined): DispatchInput | null {
  if (!target?.Input) return null;
  try {
    const parsed = JSON.parse(target.Input);
    return {
      date: parsed.date,
      action: parsed.action,
      driverName: parsed.nm,
      statusId: parsed.statusId,
    };
  } catch {
    return null;
  }
}

// ──────────────── CloudWatch 발동 이력 조회 ────────────────
interface InvocationStats {
  invocations: number;
  failedInvocations: number;
}

async function getMetricSum(
  metricName: string,
  ruleName: string,
  start: Date,
  end: Date
): Promise<number> {
  try {
    const res = await cloudWatch.send(
      new GetMetricStatisticsCommand({
        Namespace: "AWS/Events",
        MetricName: metricName,
        Dimensions: [{ Name: "RuleName", Value: ruleName }],
        StartTime: start,
        EndTime: end,
        Period: 86400,
        Statistics: ["Sum"],
      })
    );
    return (res.Datapoints ?? []).reduce((sum, p) => sum + (p.Sum ?? 0), 0);
  } catch {
    return 0;
  }
}

async function getInvocationStats(ruleName: string, since: Date, now: Date): Promise<InvocationStats> {
  const [invocations, failed] = await Promise.all([
    getMetricSum("Invocations", ruleName, since, now),
    getMetricSum("FailedInvocations", ruleName, since, now),
  ]);
  return { invocations, failedInvocations: failed };
}

// ──────────────── 규칙 나열 + 리포트 조립 ────────────────
async function listAllRules(prefix: string): Promise<Rule[]> {
  const rules: Rule[] = [];
  let nextToken: string | undefined;
  do {
    const res = await eventBridge.send(
      new ListRulesCommand({ NamePrefix: prefix, NextToken: nextToken })
    );
    rules.push(...(res.Rules ?? []));
    nextToken = res.NextToken;
  } while (nextToken);
  return rules;
}

async function buildReport(rule: Rule, now: Date): Promise<DispatchRuleReport> {
  const name = rule.Name!;
  const parsedName = parseRuleName(name);
  const fireTime = parseCronFireTime(rule.ScheduleExpression);

  const targetsRes = await eventBridge.send(new ListTargetsByRuleCommand({ Rule: name }));
  const target = targetsRes.Targets?.[0];
  const input = parseTargetInput(target);

  // CloudWatch Invocations 조회 윈도우: 발동 예정 시각 하루 전 ~ 지금
  // (파싱 실패 시 넉넉하게 400일 전부터 — 메트릭 보존 기간 내)
  const windowStart = fireTime
    ? new Date(fireTime.getTime() - 24 * 60 * 60 * 1000)
    : new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000);
  const stats = await getInvocationStats(name, windowStart, now);

  let status: DispatchRuleStatus;
  if (!fireTime) {
    status = "unparseable";
  } else if (fireTime > now) {
    status = "upcoming";
  } else if (stats.invocations > 0) {
    status = "fired";
  } else {
    status = "overdue-no-invocation";
  }

  return {
    name,
    state: rule.State,
    description: rule.Description,
    scheduleExpression: rule.ScheduleExpression,
    fireTimeUtc: fireTime ? fireTime.toISOString() : null,
    fireTimeKst: fireTime ? fireTime.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : null,
    namedDate: parsedName?.namedDate ?? null,
    dispatchId: parsedName?.dispatchId ?? null,
    isTest: parsedName?.isTest ?? false,
    target: target
      ? {
          functionArn: target.Arn,
          action: input?.action ?? null,
          driverName: input?.driverName ?? null,
          statusId: input?.statusId ?? null,
        }
      : null,
    invocations: stats.invocations,
    failedInvocations: stats.failedInvocations,
    status,
  };
}

/**
 * prefix로 시작하는 EventBridge 규칙을 전부 조회해 발동 예정/이력 리포트로 반환.
 * 발동 예정 시각(fireTimeUtc) 오름차순 정렬.
 */
export async function getDispatchRulesStatus(
  prefix: string = DEFAULT_DISPATCH_RULE_PREFIX
): Promise<DispatchRuleReport[]> {
  const now = new Date();
  const rules = await listAllRules(prefix);
  const reports = await Promise.all(rules.map((r) => buildReport(r, now)));
  reports.sort((a, b) => (a.fireTimeUtc ?? "").localeCompare(b.fireTimeUtc ?? ""));
  return reports;
}
