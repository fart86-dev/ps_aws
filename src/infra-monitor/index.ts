import { monitorRDS } from "./rds";
import { monitorDynamoDB } from "./dynamodb";
import { monitorWAF } from "./waf";
import { InfraMonitorResult } from "../types";

export async function checkInfrastructure(): Promise<InfraMonitorResult> {
  const timestamp = new Date();
  const issues: string[] = [];

  const [rdsMetrics, dynamodbMetrics, wafMetrics] = await Promise.all([
    monitorRDS().catch((error) => {
      issues.push(`RDS monitoring failed: ${error.message}`);
      return [];
    }),
    monitorDynamoDB().catch((error) => {
      issues.push(`DynamoDB monitoring failed: ${error.message}`);
      return [];
    }),
    monitorWAF().catch((error) => {
      issues.push(`WAF monitoring failed: ${error.message}`);
      return [];
    }),
  ]);

  rdsMetrics.forEach((metric) => {
    if (metric.cpuUtilization.value > 80) {
      issues.push(`RDS ${metric.instanceId}: High CPU utilization (${metric.cpuUtilization.value}%)`);
    }
    if (metric.status !== "available") {
      issues.push(`RDS ${metric.instanceId}: Status is ${metric.status}`);
    }
  });

  dynamodbMetrics.forEach((metric) => {
    if (metric.userErrors.value > 10) {
      issues.push(`DynamoDB ${metric.tableName}: High user errors (${metric.userErrors.value})`);
    }
    if (metric.systemErrors.value > 0) {
      issues.push(`DynamoDB ${metric.tableName}: System errors detected (${metric.systemErrors.value})`);
    }
    if (metric.status !== "ACTIVE") {
      issues.push(`DynamoDB ${metric.tableName}: Status is ${metric.status}`);
    }
  });

  wafMetrics.forEach((metric) => {
    if (metric.blockedRequests.value > 100) {
      issues.push(`WAF ${metric.webAclName}: High blocked requests (${metric.blockedRequests.value})`);
    }
  });

  return {
    timestamp,
    rds: rdsMetrics,
    dynamodb: dynamodbMetrics,
    waf: wafMetrics,
    summary: {
      totalChecked: rdsMetrics.length + dynamodbMetrics.length + wafMetrics.length,
      issuesFound: issues,
    },
  };
}

export { monitorRDS, monitorDynamoDB, monitorWAF };
