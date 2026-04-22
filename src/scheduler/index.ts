import cron from "node-cron";
import { checkInfrastructure } from "../infra-monitor";
import { sendIssueAlert, sendFullReport } from "../notifiers";

const CRON_SCHEDULE = process.env.CRON_SCHEDULE || "*/30 * * * *";
const NOTIFY_MODE = (process.env.NOTIFY_MODE || "issues") as "issues" | "full" | "none";

let scheduledTask: cron.ScheduledTask | null = null;

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
}

export function stopScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log("✅ Scheduler stopped");
  }
}

export function isSchedulerRunning(): boolean {
  return scheduledTask !== null;
}
