import { FreshnessJob } from "./freshnessJob";

let freshnessJobInterval: NodeJS.Timeout | null = null;

export function startScheduler() {
  // Don't start scheduler in test environment
  if (process.env.NODE_ENV === "test") {
    console.log("[Scheduler] Skipping in test environment");
    return;
  }

  const intervalMs = parseInt(process.env.FRESHNESS_JOB_INTERVAL_MS ?? "300000", 10); // default 5 minutes
  console.log(`[Scheduler] Starting freshness job with interval: ${intervalMs}ms (${intervalMs / 60000} minutes)`);

  const job = new FreshnessJob();

  // Run immediately on startup
  job.run().catch((err) => console.error("[Scheduler] Initial run failed:", err));

  // Schedule recurring runs
  freshnessJobInterval = setInterval(() => {
    job.run().catch((err) => console.error("[Scheduler] Scheduled run failed:", err));
  }, intervalMs);
}

export function stopScheduler() {
  if (freshnessJobInterval) {
    clearInterval(freshnessJobInterval);
    freshnessJobInterval = null;
    console.log("[Scheduler] Stopped");
  }
}
