import { app } from "./app";
import { startScheduler } from "./jobs/scheduler";
import { logger } from "./utils/logger";

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  logger.info("FreshFridge API running", { port });

  // Start background jobs
  startScheduler();
});
