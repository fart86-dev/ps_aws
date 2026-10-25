/**
 * dispatch-one-time-* EventBridge 규칙 상태 점검 — 실행 파일
 *
 * 사용:
 *   pnpm dispatch:rules
 *
 * 실제 조회 로직은 src/infra-monitor/dispatchRules.ts (함수 파일) 에 있다.
 */

import { getDispatchRulesStatus } from "../infra-monitor/dispatchRules";
import type { DispatchRuleReport, DispatchRuleStatus } from "../types";

function statusLabel(status: DispatchRuleStatus): string {
  switch (status) {
    case "upcoming":
      return "예정";
    case "fired":
      return "발동됨(잔재)";
    case "overdue-no-invocation":
      return "시각 지났는데 발동 이력 없음 (확인 필요)";
    case "unparseable":
      return "cron 파싱 불가 (수동 확인 필요)";
  }
}

function renderHuman(report: DispatchRuleReport): void {
  console.log(`\n[${report.name}] state=${report.state}`);
  console.log(`  발동 예정 : ${report.fireTimeKst ?? "파싱 불가"} (KST)`);
  console.log(`  상태      : ${statusLabel(report.status)}`);
  if (report.target) {
    console.log(
      `  대상      : ${report.target.functionArn} — action=${report.target.action}, driver=${report.target.driverName}, statusId=${report.target.statusId}`
    );
  }
  console.log(`  발동 이력 : Invocations=${report.invocations}, Failed=${report.failedInvocations}`);
  if (report.isTest) console.log(`  ⚠️  이름에 -test 접미사 있음`);
}

async function main() {
  const reports = await getDispatchRulesStatus();

  if (reports.length === 0) {
    console.log("dispatch-one-time-* 규칙 없음");
    return;
  }

  for (const r of reports) renderHuman(r);

  const upcoming = reports.filter((r) => r.status === "upcoming").length;
  const fired = reports.filter((r) => r.status === "fired").length;
  const overdue = reports.filter((r) => r.status === "overdue-no-invocation").length;
  console.log(
    `\n총 ${reports.length}개 — 예정 ${upcoming}, 발동됨(잔재) ${fired}, 확인필요 ${overdue}`
  );
}

main().catch((err) => {
  console.error("실행 실패:", err);
  process.exit(1);
});
