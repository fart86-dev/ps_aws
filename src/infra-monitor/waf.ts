import {
  WAFV2Client,
  ListWebACLsCommand,
} from "@aws-sdk/client-wafv2";
import {
  CloudWatchClient,
  GetMetricStatisticsCommand,
} from "@aws-sdk/client-cloudwatch";
import { WAFMetrics, MetricData } from "../types";

const wafClient = new WAFV2Client({});
const cloudWatchClient = new CloudWatchClient({});

async function getMetricData(
  metricName: string,
  webAclName: string,
  scope: string = "REGIONAL",
  period: number = 300
): Promise<MetricData> {
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - period * 1000);

  const command = new GetMetricStatisticsCommand({
    Namespace: "AWS/WAFV2",
    MetricName: metricName,
    Dimensions: [
      {
        Name: "WebACL",
        Value: webAclName,
      },
      {
        Name: "Region",
        Value: "GLOBAL",
      },
      {
        Name: "Rule",
        Value: "ALL",
      },
    ],
    StartTime: startTime,
    EndTime: endTime,
    Period: period,
    Statistics: ["Sum"],
  });

  const response = await cloudWatchClient.send(command);
  const datapoint = response.Datapoints?.[0];

  return {
    timestamp: datapoint?.Timestamp || new Date(),
    value: datapoint?.Sum || 0,
    unit: "Count",
  };
}

export async function monitorWAF(): Promise<WAFMetrics[]> {
  const command = new ListWebACLsCommand({
    Scope: "REGIONAL",
  });

  const response = await wafClient.send(command);
  const webAcls = response.WebACLs || [];
  const metrics: WAFMetrics[] = [];

  for (const webAcl of webAcls) {
    const webAclName = webAcl.Name || "";

    const [blockedData, allowedData, countedData] = await Promise.all([
      getMetricData("BlockedRequests", webAclName),
      getMetricData("AllowedRequests", webAclName),
      getMetricData("CountedRequests", webAclName),
    ]);

    metrics.push({
      webAclName,
      blockedRequests: blockedData,
      allowedRequests: allowedData,
      countedRequests: countedData,
    });
  }

  return metrics;
}
