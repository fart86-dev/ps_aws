import { Notifier } from "./types";
import { telegramNotifier, sendWasteReportToTelegram } from "./telegram";
import { slackNotifier } from "./slack";
import { InfraMonitorResult, WasteReport } from "../types";

const allNotifiers: Notifier[] = [telegramNotifier, slackNotifier];

function getActiveNotifiers(): Notifier[] {
  return allNotifiers.filter((notifier) => notifier.isConfigured());
}

export async function sendFullReport(result: InfraMonitorResult): Promise<void> {
  const notifiers = getActiveNotifiers();

  if (notifiers.length === 0) {
    console.warn("No notifiers configured");
    return;
  }

  const results = await Promise.all(
    notifiers.map((notifier) =>
      notifier
        .sendFullReport(result)
        .then((success) => ({
          name: notifier.name,
          success,
        }))
        .catch((error) => ({
          name: notifier.name,
          success: false,
          error,
        }))
    )
  );

  results.forEach((result) => {
    if (result.success) {
      console.log(`✅ ${result.name} report sent successfully`);
    } else {
      console.error(
        `❌ Failed to send ${result.name} report`,
        (result as any).error
      );
    }
  });
}

export async function sendIssueAlert(result: InfraMonitorResult): Promise<void> {
  const notifiers = getActiveNotifiers();

  if (notifiers.length === 0) {
    console.warn("No notifiers configured");
    return;
  }

  const results = await Promise.all(
    notifiers.map((notifier) =>
      notifier
        .sendIssueAlert(result)
        .then((success) => ({
          name: notifier.name,
          success,
        }))
        .catch((error) => ({
          name: notifier.name,
          success: false,
          error,
        }))
    )
  );

  results.forEach((result) => {
    if (result.success) {
      console.log(`✅ ${result.name} alert sent successfully`);
    } else {
      console.error(
        `❌ Failed to send ${result.name} alert`,
        (result as any).error
      );
    }
  });
}

export function listConfiguredNotifiers(): string[] {
  return getActiveNotifiers().map((n) => n.name);
}

/**
 * Waste report 알림. Telegram만 지원 (보고서 형식 특화).
 * Telegram 미설정 시 console에만 출력.
 */
export async function sendWasteReport(
  report: WasteReport,
  options: { onlyIfItems?: boolean } = {}
): Promise<void> {
  if (options.onlyIfItems && report.items.length === 0) {
    console.log("[waste] no items — skip alert");
    return;
  }
  const success = await sendWasteReportToTelegram(report);
  if (success) {
    console.log(
      `✅ Telegram waste report sent (${report.items.length} items, ~$${report.totalEstimatedSavingsUSD.toFixed(2)}/월)`
    );
  } else {
    console.error("❌ Telegram waste report 전송 실패 (또는 미설정)");
  }
}
