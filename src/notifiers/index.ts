import { Notifier } from "./types";
import { telegramNotifier } from "./telegram";
import { slackNotifier } from "./slack";
import { InfraMonitorResult } from "../types";

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
