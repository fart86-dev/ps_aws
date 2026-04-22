import {
  DynamoDBClient,
  ListTablesCommand,
  DescribeTableCommand,
} from "@aws-sdk/client-dynamodb";
import {
  CloudWatchClient,
  GetMetricStatisticsCommand,
} from "@aws-sdk/client-cloudwatch";
import { DynamoDBMetrics, MetricData } from "../types";

const dynamodbClient = new DynamoDBClient({});
const cloudWatchClient = new CloudWatchClient({});

async function getMetricData(
  metricName: string,
  tableName: string,
  period: number = 300
): Promise<MetricData> {
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - period * 1000);

  const command = new GetMetricStatisticsCommand({
    Namespace: "AWS/DynamoDB",
    MetricName: metricName,
    Dimensions: [
      {
        Name: "TableName",
        Value: tableName,
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

export async function monitorDynamoDB(): Promise<DynamoDBMetrics[]> {
  const listCommand = new ListTablesCommand({});
  const listResponse = await dynamodbClient.send(listCommand);

  const tableNames = listResponse.TableNames || [];
  const metrics: DynamoDBMetrics[] = [];

  for (const tableName of tableNames) {
    const describeCommand = new DescribeTableCommand({
      TableName: tableName,
    });
    const describeResponse = await dynamodbClient.send(describeCommand);
    const table = describeResponse.Table;

    const [readData, writeData, userErrorData, systemErrorData] = await Promise.all([
      getMetricData("ConsumedReadCapacityUnits", tableName),
      getMetricData("ConsumedWriteCapacityUnits", tableName),
      getMetricData("UserErrors", tableName),
      getMetricData("SystemErrors", tableName),
    ]);

    metrics.push({
      tableName,
      consumedReadCapacity: readData,
      consumedWriteCapacity: writeData,
      userErrors: userErrorData,
      systemErrors: systemErrorData,
      status: table?.TableStatus || "unknown",
    });
  }

  return metrics;
}
