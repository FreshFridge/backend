import { FreshnessJob } from "./freshnessJob";
import { logger } from "../utils/logger";

let freshnessJobInterval: NodeJS.Timeout | null = null;

export function startScheduler() {
  // Don't start scheduler in test environment
  if (process.env.NODE_ENV === "test") {
    logger.info("Scheduler skipped in test environment");
    return;
  }

  const intervalMs = parseInt(process.env.FRESHNESS_JOB_INTERVAL_MS ?? "300000", 10); // default 5 minutes
  logger.info("Starting freshness job scheduler", { intervalMs });

  const job = new FreshnessJob();

  // Run immediately on startup
  job.run().catch((err) => logger.error("Initial freshness job run failed", { error: String(err) }));

  // Schedule recurring runs
  freshnessJobInterval = setInterval(() => {
    job.run().catch((err) => logger.error("Scheduled freshness job run failed", { error: String(err) }));
  }, intervalMs);
}

export function stopScheduler() {
  if (freshnessJobInterval) {
    clearInterval(freshnessJobInterval);
    freshnessJobInterval = null;
    logger.info("Scheduler stopped");
  }
}
