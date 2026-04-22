import { Notifier } from "./types";
import { InfraMonitorResult } from "../types";

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_CHANNEL_ID = process.env.SLACK_CHANNEL_ID;

const SLACK_API_URL = "https://slack.com/api/chat.postMessage";

interface SlackApiResponse {
  ok: boolean;
  error?: string;
}

async function sendMessage(blocks: object[]): Promise<boolean> {
  try {
    const response = await fetch(SLACK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      },
      body: JSON.stringify({
        channel: SLACK_CHANNEL_ID,
        blocks,
      }),
    });

    const result = (await response.json()) as SlackApiResponse;

    if (!result.ok) {
      console.error(`Slack API error: ${result.error}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to send Slack message:", error);
    return false;
  }
}

function createMetricBlock(title: string, metrics: string[]): object {
  const text = metrics.length > 0 ? metrics.join("\n") : "데이터 없음";
  return {
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*${title}*\n${text}`,
    },
  };
}

function formatRDSMetrics(result: InfraMonitorResult): string[] {
  if (result.rds.length === 0) {
    return ["✅ RDS: 모니터링할 인스턴스가 없습니다"];
  }

  const lines: string[] = [];
  result.rds.forEach((metric) => {
    const cpuStatus = metric.cpuUtilization.value > 80 ? "⚠️" : "✅";
    const statusEmoji = metric.status === "available" ? "✅" : "⚠️";

    lines.push(
      `${statusEmoji} *${metric.instanceId}* (${metric.engine})\n` +
        `Status: ${metric.status} | ${cpuStatus} CPU: ${metric.cpuUtilization.value.toFixed(2)}% | ` +
        `Connections: ${metric.databaseConnections.value} | Storage: ${metric.allocatedStorage}GB`
    );
  });

  return lines;
}

function formatDynamoDBMetrics(result: InfraMonitorResult): string[] {
  if (result.dynamodb.length === 0) {
    return ["✅ DynamoDB: 모니터링할 테이블이 없습니다"];
  }

  const lines: string[] = [];
  result.dynamodb.forEach((metric) => {
    const statusEmoji = metric.status === "ACTIVE" ? "✅" : "⚠️";
    const errorEmoji =
      metric.userErrors.value > 10 || metric.systemErrors.value > 0
        ? "⚠️"
        : "✅";

    lines.push(
      `${statusEmoji} *${metric.tableName}* (${metric.status})\n` +
        `Read: ${metric.consumedReadCapacity.value.toFixed(2)} units | ` +
        `Write: ${metric.consumedWriteCapacity.value.toFixed(2)} units | ` +
        `${errorEmoji} User Errors: ${metric.userErrors.value} | System Errors: ${metric.systemErrors.value}`
    );
  });

  return lines;
}

function formatWAFMetrics(result: InfraMonitorResult): string[] {
  if (result.waf.length === 0) {
    return ["✅ WAF: 모니터링할 Web ACL이 없습니다"];
  }

  const lines: string[] = [];
  result.waf.forEach((metric) => {
    const blockedEmoji = metric.blockedRequests.value > 100 ? "⚠️" : "✅";

    lines.push(
      `🔒 *${metric.webAclName}*\n` +
        `${blockedEmoji} Blocked: ${metric.blockedRequests.value} | ` +
        `Allowed: ${metric.allowedRequests.value} | Counted: ${metric.countedRequests.value}`
    );
  });

  return lines;
}

function formatIssues(result: InfraMonitorResult): string[] {
  if (result.summary.issuesFound.length === 0) {
    return ["✅ 이슈가 없습니다"];
  }

  const lines: string[] = result.summary.issuesFound.map((issue) => `• ${issue}`);
  return lines;
}

export const slackNotifier: Notifier = {
  name: "Slack",

  isConfigured(): boolean {
    return !!SLACK_BOT_TOKEN && !!SLACK_CHANNEL_ID;
  },

  async sendFullReport(result: InfraMonitorResult): Promise<boolean> {
    const timestamp = new Date().toLocaleString("ko-KR");

    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "📌 AWS 인프라 점검 결과",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*시간:* ${timestamp}\n*총 확인:* ${result.summary.totalChecked}개 서비스`,
        },
      },
      {
        type: "divider",
      },
      createMetricBlock("📊 RDS 메트릭", formatRDSMetrics(result)),
      {
        type: "divider",
      },
      createMetricBlock("📊 DynamoDB 메트릭", formatDynamoDBMetrics(result)),
      {
        type: "divider",
      },
      createMetricBlock("🔒 WAF 메트릭", formatWAFMetrics(result)),
    ];

    if (result.summary.issuesFound.length > 0) {
      blocks.push({
        type: "divider",
      });
      blocks.push(createMetricBlock("⚠️ 발견된 이슈", formatIssues(result)));
    }

    return sendMessage(blocks);
  },

  async sendIssueAlert(result: InfraMonitorResult): Promise<boolean> {
    if (result.summary.issuesFound.length === 0) {
      return true;
    }

    const timestamp = new Date().toLocaleString("ko-KR");

    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🚨 AWS 인프라 이슈 감지",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*시간:* ${timestamp}`,
        },
      },
      {
        type: "divider",
      },
      createMetricBlock("이슈", formatIssues(result)),
    ];

    return sendMessage(blocks);
  },
};
