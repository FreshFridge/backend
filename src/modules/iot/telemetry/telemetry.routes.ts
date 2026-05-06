import { NextFunction, Request, Response, Router } from "express";
import { authMiddleware } from "../../../middleware/authMiddleware";
import { validateBody } from "../../../middleware/validateBody";
import { validateQuery } from "../../../middleware/validateQuery";
import { UnauthorizedError } from "../../../utils/errors";
import { createTelemetrySchema, listTelemetryQuerySchema } from "./telemetry.validation";
import { TelemetryService } from "./telemetry.service";

const router = Router();
const service = new TelemetryService();

const getApiKey = (req: Request) => {
  const value = req.headers["x-api-key"];
  return Array.isArray(value) ? value[0] : value;
};

const runJwtAuth = (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(authMiddleware(req, res, next)).catch(next);
};

router.post("/api/iot/telemetry", validateBody(createTelemetrySchema), async (req, res, next) => {
  const apiKey = getApiKey(req);

  if (apiKey) {
    const result = await service.ingestTelemetryWithApiKey(apiKey, req.body);
    res.status(201).json(result);
    return;
  }

  const authorization = req.headers.authorization;
  if (!authorization) {
    throw new UnauthorizedError("Missing API key");
  }

  runJwtAuth(req, res, async (err?: unknown) => {
    if (err) {
      next(err);
      return;
    }

    try {
      const result = await service.ingestTelemetry(req.user!.id, req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });
});

router.get(
  "/api/iot/telemetry/:fridgeId",
  authMiddleware,
  validateQuery(listTelemetryQuerySchema),
  async (req, res) => {
    const result = await service.listTelemetry(req.user!.id, req.params.fridgeId, (req as any).validatedQuery);
    res.json(result);
  }
);

router.get("/api/iot/telemetry/:fridgeId/latest", authMiddleware, async (req, res) => {
  const result = await service.getLatestTelemetry(req.user!.id, req.params.fridgeId);
  res.json(result);
});

export default router;