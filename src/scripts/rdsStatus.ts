/**
 * RDS 상태 점검 스크립트
 *
 * 사용:
 *   pnpm rds:status                          # 모든 RDS 사람 친화 출력
 *   pnpm rds:status --target dev-mshuttle    # 특정 인스턴스만
 *   pnpm rds:status --findings               # 발견된 findings만
 *   pnpm rds:status --json                   # JSON 출력 (다른 도구 파이프용)
 *   pnpm rds:status --cost                   # Cost Explorer 호출 포함 ($0.01/call)
 *   pnpm rds:status --days 7                 # 메트릭 윈도우 변경 (기본 30일)
 *
 * 보안 룰(PubliclyAccessible, default SG)은 정책상 금지로 제외.
 */

import {
  RDSClient,
  DescribeDBInstancesCommand,
  DescribeDBSnapshotsCommand,
  DescribeEventsCommand,
  type DBInstance,
  type DBSnapshot,
  type Event as RDSEvent,
} from "@aws-sdk/client-rds";
import {
  CloudWatchClient,
  GetMetricStatisticsCommand,
  type Datapoint,
} from "@aws-sdk/client-cloudwatch";
import {
  CostExplorerClient,
  GetCostAndUsageCommand,
} from "@aws-sdk/client-cost-explorer";

const REGION = "ap-northeast-2" as const;
const rds = new RDSClient({ region: REGION });
const cw = new CloudWatchClient({ region: REGION });
// Cost Explorer는 us-east-1 전용 엔드포인트
const ce = new CostExplorerClient({ region: "us-east-1" });

// ──────────────── CLI 파싱 ────────────────
interface Args {
  target?: string;
  findings: boolean;
  json: boolean;
  cost: boolean;
  days: number;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    }
  }
  return {
    target: flags.target as string | undefined,
    findings: !!flags.findings,
    json: !!flags.json,
    cost: !!flags.cost,
    days: flags.days ? Number(flags.days) : 30,
  };
}

// ──────────────── 데이터 수집 ────────────────
async function getInstances(target?: string): Promise<DBInstance[]> {
  const res = await rds.send(
    new DescribeDBInstancesCommand(target ? { DBInstanceIdentifier: target } : {})
  );
  return res.DBInstances ?? [];
}

async function getMetric(
  metricName: string,
  instanceId: string,
  days: number,
  statistics: Array<"Average" | "Maximum" | "Minimum" | "Sum">
): Promise<Datapoint[]> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  try {
    const res = await cw.send(
      new GetMetricStatisticsCommand({
        Namespace: "AWS/RDS",
        MetricName: metricName,
        Dimensions: [{ Name: "DBInstanceIdentifier", Value: instanceId }],
        StartTime: start,
        EndTime: end,
        Period: 86400,
        Statistics: statistics,
      })
    );
    return res.Datapoints ?? [];
  } catch {
    return [];
  }
}

interface MetricSummary {
  cpu: { avg: number; max: number; samples: number };
  conn: { avg: number; max: number; samples: number };
  freeStorageBytes: number | null; // min during window
  freeMemoryBytes: number | null;
}

async function getMetrics(instanceId: string, days: number): Promise<MetricSummary> {
  const [cpu, conn, storage, mem] = await Promise.all([
    getMetric("CPUUtilization", instanceId, days, ["Average", "Maximum"]),
    getMetric("DatabaseConnections", instanceId, days, ["Average", "Maximum"]),
    getMetric("FreeStorageSpace", instanceId, days, ["Minimum"]),
    getMetric("FreeableMemory", instanceId, days, ["Minimum"]),
  ]);
  const summarize = (pts: Datapoint[]) => {
    if (pts.length === 0) return { avg: 0, max: 0, samples: 0 };
    const avg = pts.reduce((s, p) => s + (p.Average ?? 0), 0) / pts.length;
    const max = Math.max(...pts.map((p) => p.Maximum ?? 0));
    return { avg, max, samples: pts.length };
  };
  return {
    cpu: summarize(cpu),
    conn: summarize(conn),
    freeStorageBytes: storage.length
      ? Math.min(...storage.map((p) => p.Minimum ?? Number.POSITIVE_INFINITY))
      : null,
    freeMemoryBytes: mem.length
      ? Math.min(...mem.map((p) => p.Minimum ?? Number.POSITIVE_INFINITY))
      : null,
  };
}

async function getSnapshots(instanceId: string): Promise<DBSnapshot[]> {
  const res = await rds.send(
    new DescribeDBSnapshotsCommand({ DBInstanceIdentifier: instanceId })
  );
  return res.DBSnapshots ?? [];
}

async function getRecentEvents(instanceId: string): Promise<RDSEvent[]> {
  const res = await rds.send(
    new DescribeEventsCommand({
      SourceIdentifier: instanceId,
      SourceType: "db-instance",
      Duration: 20160, // 14일 (분 단위)
    })
  );
  return res.Events ?? [];
}

async function getMonthlyCost(instanceId: string): Promise<number | null> {
  // 5월 한 달간 이 instance의 비용 (resource tag 매칭 필요시 별도 구현)
  // 여기는 USAGE_TYPE으로 매칭이 어려워 단순화: 인스턴스ID는 비용 데이터에 직접 안 나옴
  // → 대신 RDS 서비스 총합 / 인스턴스 수로 근사 (정확하지 않음)
  // 정확한 인스턴스별 비용은 Cost Allocation Tags 활성화 필요
  try {
    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth() - 1, 1);
    const endStr = new Date(end.getFullYear(), end.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
    const startStr = start.toISOString().slice(0, 10);
    const res = await ce.send(
      new GetCostAndUsageCommand({
        TimePeriod: { Start: startStr, End: endStr },
        Granularity: "MONTHLY",
        Metrics: ["UnblendedCost"],
        Filter: {
          And: [
            { Dimensions: { Key: "SERVICE", Values: ["Amazon Relational Database Service"] } },
            { Dimensions: { Key: "RESOURCE_ID", Values: [instanceId] } },
          ],
        },
      })
    );
    const amt = res.ResultsByTime?.[0]?.Total?.UnblendedCost?.Amount;
    return amt ? Number(amt) : null;
  } catch {
    return null;
  }
}

// ──────────────── 발견 룰 ────────────────
interface Finding {
  level: "info" | "warn" | "critical";
  code: string;
  msg: string;
}

function evaluateFindings(
  instance: DBInstance,
  metrics: MetricSummary,
  snapshots: DBSnapshot[],
  events: RDSEvent[],
  allInstances: DBInstance[]
): Finding[] {
  const findings: Finding[] = [];
  const id = instance.DBInstanceIdentifier!;
  const status = instance.DBInstanceStatus;
  const allocated = instance.AllocatedStorage ?? 0;

  // 1. Storage 낭비
  if (metrics.freeStorageBytes !== null && allocated > 0) {
    const usedGB = (allocated * 1024 * 1024 * 1024 - metrics.freeStorageBytes) / 1024 / 1024 / 1024;
    const usedPct = (usedGB / allocated) * 100;
    if (usedPct < 50 && allocated >= 50) {
      findings.push({
        level: "warn",
        code: "STORAGE_WASTE",
        msg: `Storage 낭비: ${allocated}GB 중 ${usedGB.toFixed(1)}GB 사용 (${usedPct.toFixed(0)}%) → 축소 검토`,
      });
    }
  }

  // 2. gp2 사용
  if (instance.StorageType === "gp2") {
    findings.push({
      level: "info",
      code: "STORAGE_GP2",
      msg: "gp3 전환 권장 (무중단, 20% 절감)",
    });
  }

  // 3. Stopped 장기간
  if (status === "stopped") {
    const lastStop = events
      .filter((e) => e.Message?.toLowerCase().includes("stopped"))
      .sort((a, b) => (b.Date?.getTime() ?? 0) - (a.Date?.getTime() ?? 0))[0];
    if (lastStop?.Date) {
      const days = Math.floor((Date.now() - lastStop.Date.getTime()) / (24 * 60 * 60 * 1000));
      if (days >= 14) {
        findings.push({
          level: "warn",
          code: "STOPPED_LONG",
          msg: `${days}일째 stopped (RDS는 7일마다 자동 재시작됨, storage 비용 계속 발생)`,
        });
      } else {
        findings.push({
          level: "info",
          code: "STOPPED",
          msg: `${days}일째 stopped`,
        });
      }
    } else {
      findings.push({
        level: "info",
        code: "STOPPED",
        msg: "stopped 상태 (정확한 stop 시점 미확인)",
      });
    }
  }

  // 4. Connection 0 (available 인스턴스만)
  if (status === "available" && metrics.conn.samples > 0 && metrics.conn.max === 0) {
    findings.push({
      level: "warn",
      code: "ZERO_CONNECTION",
      msg: "최근 외부 connection 0 → 사용 여부 확인",
    });
  }

  // 5. CPU underutilized
  if (status === "available" && metrics.cpu.samples > 0 && metrics.cpu.max < 10) {
    findings.push({
      level: "info",
      code: "CPU_LOW",
      msg: `CPU max ${metrics.cpu.max.toFixed(1)}% → 다운사이즈 검토 가능`,
    });
  }

  // 6. Snapshot 누적
  const autoSnapshots = snapshots.filter((s) => s.SnapshotType === "automated").length;
  if (autoSnapshots > 15) {
    findings.push({
      level: "info",
      code: "SNAPSHOT_MANY",
      msg: `자동 snapshot ${autoSnapshots}개 (보관 정책 검토)`,
    });
  }

  // 7. Read replica AZ 불일치
  const sourceId = instance.ReadReplicaSourceDBInstanceIdentifier;
  if (sourceId) {
    const source = allInstances.find((i) => i.DBInstanceIdentifier === sourceId);
    if (source && source.AvailabilityZone !== instance.AvailabilityZone) {
      findings.push({
        level: "warn",
        code: "REPLICA_CROSS_AZ",
        msg: `read replica가 source(${source.AvailabilityZone})와 다른 AZ(${instance.AvailabilityZone}) → Inter-AZ DT 비용 발생`,
      });
    }
  }

  // 8. EOL Engine (대략 룰)
  const engine = instance.Engine ?? "";
  const ver = instance.EngineVersion ?? "";
  const major = parseInt(ver.split(".")[0] ?? "0", 10);
  if (engine === "mysql" && major < 8) {
    findings.push({ level: "critical", code: "ENGINE_EOL", msg: `MySQL ${ver} EOL` });
  } else if (engine === "postgres" && major < 14) {
    findings.push({ level: "warn", code: "ENGINE_EOL", msg: `PostgreSQL ${ver} EOL 임박/지남` });
  } else if (engine === "mariadb" && major < 10) {
    findings.push({ level: "critical", code: "ENGINE_EOL", msg: `MariaDB ${ver} EOL` });
  }

  return findings;
}

// ──────────────── 리포트 ────────────────
interface InstanceReport {
  id: string;
  engine: string;
  version: string;
  class: string;
  az: string;
  multiAz: boolean;
  status: string;
  storage: {
    allocatedGB: number;
    type: string;
    usedGB: number | null;
    usedPct: number | null;
  };
  metrics: MetricSummary;
  snapshots: { auto: number; manual: number; total: number };
  monthlyCost: number | null;
  findings: Finding[];
  replicaOf?: string;
}

async function buildReport(
  instance: DBInstance,
  allInstances: DBInstance[],
  days: number,
  withCost: boolean
): Promise<InstanceReport> {
  const id = instance.DBInstanceIdentifier!;
  const [metrics, snapshots, events, cost] = await Promise.all([
    getMetrics(id, days),
    getSnapshots(id),
    getRecentEvents(id),
    withCost ? getMonthlyCost(id) : Promise.resolve(null),
  ]);

  const allocated = instance.AllocatedStorage ?? 0;
  const usedGB =
    metrics.freeStorageBytes !== null && allocated > 0
      ? allocated - metrics.freeStorageBytes / 1024 / 1024 / 1024
      : null;

  const findings = evaluateFindings(instance, metrics, snapshots, events, allInstances);

  return {
    id,
    engine: instance.Engine ?? "?",
    version: instance.EngineVersion ?? "?",
    class: instance.DBInstanceClass ?? "?",
    az: instance.AvailabilityZone ?? "?",
    multiAz: !!instance.MultiAZ,
    status: instance.DBInstanceStatus ?? "?",
    storage: {
      allocatedGB: allocated,
      type: instance.StorageType ?? "?",
      usedGB,
      usedPct: usedGB !== null && allocated > 0 ? (usedGB / allocated) * 100 : null,
    },
    metrics,
    snapshots: {
      auto: snapshots.filter((s) => s.SnapshotType === "automated").length,
      manual: snapshots.filter((s) => s.SnapshotType === "manual").length,
      total: snapshots.length,
    },
    monthlyCost: cost,
    findings,
    replicaOf: instance.ReadReplicaSourceDBInstanceIdentifier,
  };
}

// ──────────────── 렌더링 ────────────────
function gb(bytes: number | null): string {
  if (bytes === null) return "?";
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function renderHuman(report: InstanceReport): void {
  console.log(`\n[${report.id}] ${report.engine} ${report.version}, ${report.class}, ${report.az}${report.multiAz ? " (Multi-AZ)" : ""}, ${report.status}`);
  if (report.replicaOf) console.log(`  ↳ read replica of: ${report.replicaOf}`);

  const s = report.storage;
  const usedStr =
    s.usedGB !== null && s.usedPct !== null
      ? `used ${s.usedGB.toFixed(1)}GB (${s.usedPct.toFixed(0)}%)`
      : "사용량 미확인";
  console.log(`  Storage      : ${s.allocatedGB}GB ${s.type}, ${usedStr}`);

  const m = report.metrics;
  if (m.cpu.samples > 0) {
    console.log(`  CPU          : avg ${m.cpu.avg.toFixed(1)}%, max ${m.cpu.max.toFixed(1)}%`);
  }
  if (m.conn.samples > 0) {
    console.log(`  Connections  : avg ${m.conn.avg.toFixed(1)}, max ${m.conn.max.toFixed(0)}`);
  }
  if (m.freeMemoryBytes !== null) {
    console.log(`  Memory free  : min ${gb(m.freeMemoryBytes)}`);
  }
  console.log(`  Snapshots    : auto ${report.snapshots.auto}, manual ${report.snapshots.manual}`);
  if (report.monthlyCost !== null) {
    console.log(`  Monthly cost : $${report.monthlyCost.toFixed(2)}`);
  }

  if (report.findings.length === 0) {
    console.log(`  Findings     : 없음`);
  } else {
    console.log(`  Findings     :`);
    for (const f of report.findings) {
      const mark = f.level === "critical" ? "🔴" : f.level === "warn" ? "⚠️ " : "ℹ️ ";
      console.log(`    ${mark} ${f.msg}`);
    }
  }
}

function renderFindings(reports: InstanceReport[]): void {
  let any = false;
  for (const r of reports) {
    if (r.findings.length === 0) continue;
    any = true;
    console.log(`\n[${r.id}]`);
    for (const f of r.findings) {
      const mark = f.level === "critical" ? "🔴" : f.level === "warn" ? "⚠️ " : "ℹ️ ";
      console.log(`  ${mark} [${f.code}] ${f.msg}`);
    }
  }
  if (!any) console.log("findings 없음 — 모든 RDS 정상");
}

// ──────────────── 진입점 ────────────────
async function main() {
  const args = parseArgs();
  const all = await getInstances();
  if (all.length === 0) {
    console.log("RDS 인스턴스 없음");
    return;
  }

  const targets = args.target ? all.filter((i) => i.DBInstanceIdentifier === args.target) : all;
  if (targets.length === 0) {
    console.error(`--target ${args.target} 일치하는 인스턴스 없음`);
    process.exit(1);
  }

  const reports = await Promise.all(targets.map((i) => buildReport(i, all, args.days, args.cost)));

  if (args.json) {
    console.log(JSON.stringify(reports, null, 2));
  } else if (args.findings) {
    renderFindings(reports);
  } else {
    for (const r of reports) renderHuman(r);
    const totalFindings = reports.reduce((s, r) => s + r.findings.length, 0);
    console.log(`\n총 ${reports.length}개 인스턴스, findings ${totalFindings}건`);
  }
}

main().catch((err) => {
  console.error("실행 실패:", err);
  process.exit(1);
});
