import { Notifier } from "./types";
import { InfraMonitorResult } from "../types";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

async function sendMessage(message: string): Promise<boolean> {
  console.log("텔레그램");
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "HTML",
      }),
    });

    if (!response.ok) {
      console.error(`Telegram API error: ${response.status}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to send Telegram message:", error);
    return false;
  }
}

function formatMetricValue(value: number, unit: string): string {
  return `${value.toFixed(2)} ${unit}`;
}

function formatRDSMetrics(result: InfraMonitorResult): string {
  if (result.rds.length === 0) {
    return "✅ RDS: 모니터링할 인스턴스가 없습니다\n";
  }

  let text = "📊 <b>RDS 메트릭</b>\n";
  result.rds.forEach((metric) => {
    const cpuStatus = metric.cpuUtilization.value > 80 ? "⚠️" : "✅";
    const statusEmoji = metric.status === "available" ? "✅" : "⚠️";

    text += `${statusEmoji} <b>${metric.instanceId}</b>\n`;
    text += `  Engine: ${metric.engine}\n`;
    text += `  Status: ${metric.status}\n`;
    text += `  ${cpuStatus} CPU: ${formatMetricValue(metric.cpuUtilization.value, "%")}\n`;
    text += `  🔗 Connections: ${metric.databaseConnections.value}\n`;
    text += `  💾 Storage: ${metric.allocatedStorage} GB\n\n`;
  });

  return text;
}

function formatDynamoDBMetrics(result: InfraMonitorResult): string {
  if (result.dynamodb.length === 0) {
    return "✅ DynamoDB: 모니터링할 테이블이 없습니다\n";
  }

  let text = "📊 <b>DynamoDB 메트릭</b>\n";
  result.dynamodb.forEach((metric) => {
    const statusEmoji = metric.status === "ACTIVE" ? "✅" : "⚠️";
    const errorEmoji =
      metric.userErrors.value > 10 || metric.systemErrors.value > 0
        ? "⚠️"
        : "✅";

    text += `${statusEmoji} <b>${metric.tableName}</b>\n`;
    text += `  Status: ${metric.status}\n`;
    text += `  📖 Read: ${formatMetricValue(metric.consumedReadCapacity.value, "units")}\n`;
    text += `  ✏️ Write: ${formatMetricValue(metric.consumedWriteCapacity.value, "units")}\n`;
    text += `  ${errorEmoji} User Errors: ${metric.userErrors.value}\n`;
    text += `  ${errorEmoji} System Errors: ${metric.systemErrors.value}\n\n`;
  });

  return text;
}

function formatWAFMetrics(result: InfraMonitorResult): string {
  if (result.waf.length === 0) {
    return "✅ WAF: 모니터링할 Web ACL이 없습니다\n";
  }

  let text = "📊 <b>WAF 메트릭</b>\n";
  result.waf.forEach((metric) => {
    const blockedEmoji = metric.blockedRequests.value > 100 ? "⚠️" : "✅";

    text += `🔒 <b>${metric.webAclName}</b>\n`;
    text += `  ${blockedEmoji} Blocked: ${metric.blockedRequests.value}\n`;
    text += `  ✅ Allowed: ${metric.allowedRequests.value}\n`;
    text += `  📊 Counted: ${metric.countedRequests.value}\n\n`;
  });

  return text;
}

function formatIssues(result: InfraMonitorResult): string {
  if (result.summary.issuesFound.length === 0) {
    return "✅ 이슈가 없습니다\n";
  }

  let text = "⚠️ <b>발견된 이슈</b>\n";
  result.summary.issuesFound.forEach((issue) => {
    text += `• ${issue}\n`;
  });

  return text + "\n";
}

export const telegramNotifier: Notifier = {
  name: "Telegram",

  isConfigured(): boolean {
    return !!TELEGRAM_BOT_TOKEN && !!TELEGRAM_CHAT_ID;
  },

  async sendFullReport(result: InfraMonitorResult): Promise<boolean> {
    const timestamp = new Date().toLocaleString("ko-KR");

    let message = `📌 <b>AWS 인프라 점검 결과</b>\n`;
    message += `시간: ${timestamp}\n`;
    message += `총 확인: ${result.summary.totalChecked}개 서비스\n\n`;

    message += formatRDSMetrics(result);
    message += formatDynamoDBMetrics(result);
    message += formatWAFMetrics(result);
    message += formatIssues(result);

    return sendMessage(message);
  },

  async sendIssueAlert(result: InfraMonitorResult): Promise<boolean> {
    if (result.summary.issuesFound.length === 0) {
      return true;
    }

    const timestamp = new Date().toLocaleString("ko-KR");

    let message = `🚨 <b>AWS 인프라 이슈 감지</b>\n`;
    message += `시간: ${timestamp}\n\n`;

    result.summary.issuesFound.forEach((issue) => {
      message += `⚠️ ${issue}\n`;
    });

    return sendMessage(message);
  },
};
