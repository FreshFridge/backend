import { app } from "./app";
import { startScheduler } from "./jobs/scheduler";

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`FreshFridge API running: http://localhost:${port}`);

  // Start background jobs
  startScheduler();
});