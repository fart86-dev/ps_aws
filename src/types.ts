export interface MetricData {
  timestamp: Date;
  value: number;
  unit: string;
}

export interface RDSMetrics {
  instanceId: string;
  cpuUtilization: MetricData;
  databaseConnections: MetricData;
  allocatedStorage: number;
  status: string;
  engine: string;
}

export interface DynamoDBMetrics {
  tableName: string;
  consumedReadCapacity: MetricData;
  consumedWriteCapacity: MetricData;
  userErrors: MetricData;
  systemErrors: MetricData;
  status: string;
}

export interface WAFMetrics {
  webAclName: string;
  blockedRequests: MetricData;
  allowedRequests: MetricData;
  countedRequests: MetricData;
}

export interface InfraMonitorResult {
  timestamp: Date;
  rds: RDSMetrics[];
  dynamodb: DynamoDBMetrics[];
  waf: WAFMetrics[];
  summary: {
    totalChecked: number;
    issuesFound: string[];
  };
}

export type WasteCategory =
  | "stopped-ec2"
  | "idle-eip"
  | "unattached-ebs"
  | "unattached-eni"
  | "old-snapshot"
  | "rds-storage-waste"
  | "rds-storage-gp2"
  | "rds-replica-cross-az";

export interface WasteItem {
  category: WasteCategory;
  resourceId: string;
  name?: string;
  detail: string;
  estimatedMonthlySavingUSD: number;
  severity: "info" | "warn";
}

export interface WasteReport {
  timestamp: Date;
  region: string;
  items: WasteItem[];
  totalEstimatedSavingsUSD: number;
  totals: Record<WasteCategory, number>;
}
