import cron from "node-cron";
import { checkInfrastructure } from "../infra-monitor";
import { collectWaste } from "../infra-monitor/waste";
import { sendIssueAlert, sendFullReport, sendWasteReport } from "../notifiers";

const CRON_SCHEDULE = process.env.CRON_SCHEDULE || "*/30 * * * *";
const NOTIFY_MODE = (process.env.NOTIFY_MODE || "issues") as "issues" | "full" | "none";

// 매주 월요일 KST 오전 9시 (UTC 00:00 월)
const WASTE_CRON_SCHEDULE = process.env.WASTE_CRON_SCHEDULE || "0 0 * * 1";

let scheduledTask: cron.ScheduledTask | null = null;
let wasteTask: cron.ScheduledTask | null = null;

async function runCheck(): Promise<void> {
  try {
    console.log(`[${new Date().toISOString()}] Running infrastructure check...`);

    const result = await checkInfrastructure();

    if (NOTIFY_MODE === "issues") {
      await sendIssueAlert(result);
    } else if (NOTIFY_MODE === "full") {
      await sendFullReport(result);
    }

    console.log(`[${new Date().toISOString()}] Check completed. Issues found: ${result.summary.issuesFound.length}`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Check failed:`, error);
  }
}

async function runWasteCheck(): Promise<void> {
  try {
    console.log(`[${new Date().toISOString()}] Running waste check...`);
    const report = await collectWaste();
    await sendWasteReport(report, { onlyIfItems: true });
    console.log(
      `[${new Date().toISOString()}] Waste check completed. Items: ${report.items.length}, ~$${report.totalEstimatedSavingsUSD.toFixed(2)}/월`
    );
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Waste check failed:`, error);
  }
}

export function startScheduler(): void {
  if (scheduledTask) {
    console.warn("Scheduler is already running");
    return;
  }

  if (!cron.validate(CRON_SCHEDULE)) {
    console.error(`Invalid cron schedule: ${CRON_SCHEDULE}`);
    return;
  }

  scheduledTask = cron.schedule(CRON_SCHEDULE, runCheck);

  console.log(`✅ Scheduler started with cron: "${CRON_SCHEDULE}"`);
  console.log(`   Notify mode: ${NOTIFY_MODE}`);

  if (cron.validate(WASTE_CRON_SCHEDULE)) {
    wasteTask = cron.schedule(WASTE_CRON_SCHEDULE, runWasteCheck);
    console.log(`✅ Waste scheduler started with cron: "${WASTE_CRON_SCHEDULE}"`);
  } else {
    console.error(`Invalid waste cron schedule: ${WASTE_CRON_SCHEDULE}`);
  }
}

export function stopScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log("✅ Scheduler stopped");
  }
  if (wasteTask) {
    wasteTask.stop();
    wasteTask = null;
    console.log("✅ Waste scheduler stopped");
  }
}

export function isSchedulerRunning(): boolean {
  return scheduledTask !== null;
}
