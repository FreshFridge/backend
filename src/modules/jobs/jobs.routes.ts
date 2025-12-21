import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import { FreshnessJob } from "../../jobs/freshnessJob";

const router = Router();

// Manual trigger for freshness job (for testing/admin purposes)
router.post("/api/jobs/freshness/run", authMiddleware, async (req, res) => {
  const job = new FreshnessJob();
  const stats = await job.run();
  res.json({
    success: true,
    stats,
    message: `Freshness job completed. Checked ${stats.checked} products, created ${stats.created} notifications.`,
  });
});

export default router;
