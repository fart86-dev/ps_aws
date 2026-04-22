import {
  RDSClient,
  DescribeDBInstancesCommand,
} from "@aws-sdk/client-rds";
import {
  CloudWatchClient,
  GetMetricStatisticsCommand,
} from "@aws-sdk/client-cloudwatch";
import { RDSMetrics, MetricData } from "../types";

const rdsClient = new RDSClient({});
const cloudWatchClient = new CloudWatchClient({});

async function getMetricData(
  metricName: string,
  instanceId: string,
  period: number = 300
): Promise<MetricData> {
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - period * 1000);

  const command = new GetMetricStatisticsCommand({
    Namespace: "AWS/RDS",
    MetricName: metricName,
    Dimensions: [
      {
        Name: "DBInstanceIdentifier",
        Value: instanceId,
      },
    ],
    StartTime: startTime,
    EndTime: endTime,
    Period: period,
    Statistics: ["Average"],
  });

  const response = await cloudWatchClient.send(command);
  const datapoint = response.Datapoints?.[0];

  return {
    timestamp: datapoint?.Timestamp || new Date(),
    value: datapoint?.Average || 0,
    unit: "%",
  };
}

export async function monitorRDS(): Promise<RDSMetrics[]> {
  const command = new DescribeDBInstancesCommand({});
  const response = await rdsClient.send(command);

  const instances = response.DBInstances || [];
  const targetInstances = process.env.RDS_INSTANCE_NAMES
    ? process.env.RDS_INSTANCE_NAMES.split(",").map((name) => name.trim())
    : null;

  const metrics: RDSMetrics[] = [];

  for (const instance of instances) {
    const instanceId = instance.DBInstanceIdentifier || "";

    if (targetInstances && !targetInstances.includes(instanceId)) {
      continue;
    }

    const [cpuData, connData] = await Promise.all([
      getMetricData("CPUUtilization", instanceId),
      getMetricData("DatabaseConnections", instanceId),
    ]);

    metrics.push({
      instanceId,
      cpuUtilization: cpuData,
      databaseConnections: connData,
      allocatedStorage: instance.AllocatedStorage || 0,
      status: instance.DBInstanceStatus || "unknown",
      engine: instance.Engine || "unknown",
    });
  }

  return metrics;
}
