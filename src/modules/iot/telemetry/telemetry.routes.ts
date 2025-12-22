import { Router } from "express";
import { authMiddleware } from "../../../middleware/authMiddleware";
import { validateBody } from "../../../middleware/validateBody";
import { validateQuery } from "../../../middleware/validateQuery";
import { createTelemetrySchema, listTelemetryQuerySchema } from "./telemetry.validation";
import { TelemetryService } from "./telemetry.service";

const router = Router();
const service = new TelemetryService();

// Ingest telemetry data from fridge (simulated IoT)
router.post("/api/iot/telemetry", authMiddleware, validateBody(createTelemetrySchema), async (req, res) => {
  const result = await service.ingestTelemetry(req.user!.id, req.body);
  res.status(201).json(result);
});

// Get telemetry history for a fridge
router.get(
  "/api/iot/telemetry/:fridgeId",
  authMiddleware,
  validateQuery(listTelemetryQuerySchema),
  async (req, res) => {
    const result = await service.listTelemetry(req.user!.id, req.params.fridgeId, (req as any).validatedQuery);
    res.json(result);
  }
);

// Get latest telemetry snapshot for a fridge
router.get("/api/iot/telemetry/:fridgeId/latest", authMiddleware, async (req, res) => {
  const result = await service.getLatestTelemetry(req.user!.id, req.params.fridgeId);
  res.json(result);
});

export default router;
