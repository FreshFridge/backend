import { app } from "./app";
import { startScheduler } from "./jobs/scheduler";
import { logger } from "./utils/logger";

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  logger.info("FreshFridge API running", { port });

  if (process.env.RUN_SCHEDULER !== "false") {
    startScheduler();
  } else {
    logger.info("Freshness scheduler disabled for this instance");
  }
});
