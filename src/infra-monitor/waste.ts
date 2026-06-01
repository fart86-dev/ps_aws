/**
 * 낭비 자원 검출 모듈.
 *
 * 일회성 점검 (`pnpm rds:status`, `pnpm waf:bot status`)와 다르게,
 * 정기 실행되어 새로 쌓인 잔재를 발견하고 Telegram 알림으로 보낸다.
 *
 * 검출 카테고리:
 *  - stopped-ec2          : N일 이상 stopped EC2 인스턴스
 *  - idle-eip             : 어디에도 연결되지 않거나 stopped 인스턴스에 묶인 EIP
 *  - unattached-ebs       : 어떤 인스턴스에도 attach되지 않은 EBS volume
 *  - unattached-eni       : 사용처 없는 ENI (managed 자원 제외)
 *  - old-snapshot         : 1년 이상된 self-owned snapshot
 *  - rds-storage-waste    : 할당 storage 사용률 < 50%
 *  - rds-storage-gp2      : gp2 사용 중 (gp3 무중단 전환 권장)
 *  - rds-replica-cross-az : read replica AZ가 source와 다름 (Inter-AZ DT 비용)
 */

import {
  EC2Client,
  DescribeInstancesCommand,
  DescribeAddressesCommand,
  DescribeVolumesCommand,
  DescribeNetworkInterfacesCommand,
  DescribeSnapshotsCommand,
} from "@aws-sdk/client-ec2";
import {
  RDSClient,
  DescribeDBInstancesCommand,
  type DBInstance,
} from "@aws-sdk/client-rds";
import {
  CloudWatchClient,
  GetMetricStatisticsCommand,
} from "@aws-sdk/client-cloudwatch";
import type { WasteCategory, WasteItem, WasteReport } from "../types";

const REGION = process.env.AWS_REGION || "ap-northeast-2";
const STOPPED_EC2_THRESHOLD_DAYS = Number(process.env.WASTE_STOPPED_EC2_DAYS ?? 14);
const OLD_SNAPSHOT_THRESHOLD_DAYS = Number(process.env.WASTE_OLD_SNAPSHOT_DAYS ?? 365);
const RDS_STORAGE_WASTE_PCT = Number(process.env.WASTE_RDS_STORAGE_PCT ?? 50);

const ec2 = new EC2Client({ region: REGION });
const rds = new RDSClient({ region: REGION });
const cw = new CloudWatchClient({ region: REGION });

// 서울 리전 단가 (대략)
const PRICE = {
  EIP_IDLE_PER_MONTH: 3.6,
  EBS_GP3_PER_GB_MONTH: 0.0912,
  EBS_GP2_PER_GB_MONTH: 0.114,
  EBS_IO1_PER_GB_MONTH: 0.142,
  SNAPSHOT_PER_GB_MONTH: 0.05,
};

// ──────────────── 헬퍼 ────────────────
const daysAgo = (d: Date) =>
  Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));

const tagName = (tags?: Array<{ Key?: string; Value?: string }>) =>
  tags?.find((t) => t.Key === "Name")?.Value;

const ebsPricePerGB = (type?: string): number => {
  switch (type) {
    case "gp3":
      return PRICE.EBS_GP3_PER_GB_MONTH;
    case "gp2":
      return PRICE.EBS_GP2_PER_GB_MONTH;
    case "io1":
    case "io2":
      return PRICE.EBS_IO1_PER_GB_MONTH;
    default:
      return PRICE.EBS_GP3_PER_GB_MONTH;
  }
};

// ──────────────── 수집기 ────────────────
async function findStoppedEC2(): Promise<WasteItem[]> {
  const res = await ec2.send(
    new DescribeInstancesCommand({
      Filters: [{ Name: "instance-state-name", Values: ["stopped"] }],
    })
  );
  const items: WasteItem[] = [];
  for (const r of res.Reservations ?? []) {
    for (const inst of r.Instances ?? []) {
      if (!inst.InstanceId) continue;
      // StateTransitionReason 에 시각이 포함됨: "User initiated (2026-05-28 10:49:09 GMT)"
      const match = inst.StateTransitionReason?.match(
        /\((\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) GMT\)/
      );
      const stoppedAt = match ? new Date(match[1] + "Z") : null;
      const days = stoppedAt ? daysAgo(stoppedAt) : 0;
      if (stoppedAt && days < STOPPED_EC2_THRESHOLD_DAYS) continue;
      items.push({
        category: "stopped-ec2",
        resourceId: inst.InstanceId,
        name: tagName(inst.Tags),
        detail: stoppedAt
          ? `${days}일째 stopped (since ${stoppedAt.toISOString().slice(0, 10)})`
          : "stopped (정확한 시점 미확인)",
        estimatedMonthlySavingUSD: 0, // EBS는 별도 항목으로 잡힘
        severity: "warn",
      });
    }
  }
  return items;
}

async function findIdleEIPs(): Promise<WasteItem[]> {
  const res = await ec2.send(new DescribeAddressesCommand({}));
  const items: WasteItem[] = [];
  for (const a of res.Addresses ?? []) {
    if (!a.PublicIp) continue;
    // EIP가 어디에도 연결되어 있지 않으면 idle
    const idle = !a.AssociationId;
    if (!idle) continue;
    items.push({
      category: "idle-eip",
      resourceId: a.AllocationId ?? a.PublicIp,
      name: a.PublicIp,
      detail: "어디에도 연결되지 않은 EIP",
      estimatedMonthlySavingUSD: PRICE.EIP_IDLE_PER_MONTH,
      severity: "warn",
    });
  }
  return items;
}

async function findUnattachedEBS(): Promise<WasteItem[]> {
  const res = await ec2.send(
    new DescribeVolumesCommand({
      Filters: [{ Name: "status", Values: ["available"] }],
    })
  );
  const items: WasteItem[] = [];
  for (const v of res.Volumes ?? []) {
    if (!v.VolumeId) continue;
    const size = v.Size ?? 0;
    const cost = size * ebsPricePerGB(v.VolumeType);
    items.push({
      category: "unattached-ebs",
      resourceId: v.VolumeId,
      name: tagName(v.Tags),
      detail: `${size}GB ${v.VolumeType ?? "?"} unattached`,
      estimatedMonthlySavingUSD: cost,
      severity: "warn",
    });
  }
  return items;
}

async function findUnattachedENIs(): Promise<WasteItem[]> {
  const res = await ec2.send(
    new DescribeNetworkInterfacesCommand({
      Filters: [{ Name: "status", Values: ["available"] }],
    })
  );
  const items: WasteItem[] = [];
  for (const eni of res.NetworkInterfaces ?? []) {
    if (!eni.NetworkInterfaceId) continue;
    // AWS managed ENI (Lambda, RDS, ELB 등)는 보통 RequesterManaged=true 또는 Description에 표식
    // RequesterManaged인 ENI는 원본 자원 정리 시 자동 정리되므로 건드리지 말 것
    if (eni.RequesterManaged) continue;
    items.push({
      category: "unattached-eni",
      resourceId: eni.NetworkInterfaceId,
      name: eni.Description || undefined,
      detail: `${eni.Description ?? "ENI"} (정리 차원)`,
      estimatedMonthlySavingUSD: 0,
      severity: "info",
    });
  }
  return items;
}

async function findOldSnapshots(): Promise<WasteItem[]> {
  const res = await ec2.send(
    new DescribeSnapshotsCommand({ OwnerIds: ["self"] })
  );
  const items: WasteItem[] = [];
  for (const s of res.Snapshots ?? []) {
    if (!s.SnapshotId || !s.StartTime) continue;
    const days = daysAgo(s.StartTime);
    if (days < OLD_SNAPSHOT_THRESHOLD_DAYS) continue;
    const size = s.VolumeSize ?? 0;
    items.push({
      category: "old-snapshot",
      resourceId: s.SnapshotId,
      name: s.Description || undefined,
      detail: `${size}GB, ${days}일 묵힌 snapshot`,
      estimatedMonthlySavingUSD: size * PRICE.SNAPSHOT_PER_GB_MONTH,
      severity: "info",
    });
  }
  return items;
}

async function findRDSWaste(): Promise<WasteItem[]> {
  const res = await rds.send(new DescribeDBInstancesCommand({}));
  const instances = res.DBInstances ?? [];
  const items: WasteItem[] = [];

  for (const inst of instances) {
    const id = inst.DBInstanceIdentifier;
    if (!id) continue;
    const allocated = inst.AllocatedStorage ?? 0;

    // gp2 사용
    if (inst.StorageType === "gp2") {
      items.push({
        category: "rds-storage-gp2",
        resourceId: id,
        detail: "gp2 사용 (gp3 무중단 전환 권장, ~20% 절감)",
        estimatedMonthlySavingUSD: allocated * 0.0228, // gp2->gp3 차이 단가 근사
        severity: "info",
      });
    }

    // read replica AZ 불일치
    const sourceId = inst.ReadReplicaSourceDBInstanceIdentifier;
    if (sourceId) {
      const source = instances.find((i) => i.DBInstanceIdentifier === sourceId);
      if (source && source.AvailabilityZone !== inst.AvailabilityZone) {
        items.push({
          category: "rds-replica-cross-az",
          resourceId: id,
          detail: `read replica가 source(${source.AvailabilityZone})와 다른 AZ(${inst.AvailabilityZone}) → Inter-AZ DT 비용`,
          estimatedMonthlySavingUSD: 0, // 트래픽 변동이라 단정 어려움
          severity: "warn",
        });
      }
    }

    // storage 사용률 (CloudWatch FreeStorageSpace)
    if (allocated > 0) {
      try {
        const end = new Date();
        const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        const m = await cw.send(
          new GetMetricStatisticsCommand({
            Namespace: "AWS/RDS",
            MetricName: "FreeStorageSpace",
            Dimensions: [{ Name: "DBInstanceIdentifier", Value: id }],
            StartTime: start,
            EndTime: end,
            Period: 86400,
            Statistics: ["Minimum"],
          })
        );
        const pts = m.Datapoints ?? [];
        if (pts.length > 0) {
          const minFree = Math.min(
            ...pts.map((p) => p.Minimum ?? Number.POSITIVE_INFINITY)
          );
          const usedGB = allocated - minFree / 1024 / 1024 / 1024;
          const usedPct = (usedGB / allocated) * 100;
          if (usedPct < RDS_STORAGE_WASTE_PCT && allocated >= 50) {
            const wastedGB = allocated - Math.ceil(usedGB * 1.5); // 50% 여유로 보고
            const cost = wastedGB * ebsPricePerGB("gp3");
            items.push({
              category: "rds-storage-waste",
              resourceId: id,
              detail: `${allocated}GB 중 ${usedGB.toFixed(1)}GB 사용 (${usedPct.toFixed(0)}%) → 마이그레이션으로 축소 검토`,
              estimatedMonthlySavingUSD: Math.max(0, cost),
              severity: "warn",
            });
          }
        }
      } catch {
        // metric 조회 실패는 무시
      }
    }
  }

  return items;
}

// ──────────────── 통합 ────────────────
export async function collectWaste(): Promise<WasteReport> {
  const collectors: Promise<WasteItem[]>[] = [
    findStoppedEC2(),
    findIdleEIPs(),
    findUnattachedEBS(),
    findUnattachedENIs(),
    findOldSnapshots(),
    findRDSWaste(),
  ];
  const results = await Promise.allSettled(collectors);
  const items: WasteItem[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") items.push(...r.value);
    else console.error("waste collector 실패:", r.reason);
  }

  const totals: Record<WasteCategory, number> = {
    "stopped-ec2": 0,
    "idle-eip": 0,
    "unattached-ebs": 0,
    "unattached-eni": 0,
    "old-snapshot": 0,
    "rds-storage-waste": 0,
    "rds-storage-gp2": 0,
    "rds-replica-cross-az": 0,
  };
  for (const it of items) totals[it.category]++;

  return {
    timestamp: new Date(),
    region: REGION,
    items,
    totalEstimatedSavingsUSD: items.reduce(
      (s, it) => s + it.estimatedMonthlySavingUSD,
      0
    ),
    totals,
  };
}
