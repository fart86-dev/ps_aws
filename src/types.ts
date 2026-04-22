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
