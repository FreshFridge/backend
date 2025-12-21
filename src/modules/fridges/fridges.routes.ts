import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import { validateBody } from "../../middleware/validateBody";
import { createFridgeSchema, updateFridgeSchema } from "./fridges.validation";
import { FridgesService } from "./fridges.service";

const router = Router();
const service = new FridgesService();

router.post("/api/fridges", authMiddleware, validateBody(createFridgeSchema), async (req, res) => {
  const result = await service.create(req.user!.id, req.body);
  res.status(201).json(result);
});

router.get("/api/fridges", authMiddleware, async (req, res) => {
  const result = await service.list(req.user!.id);
  res.json(result);
});

router.get("/api/fridges/:id", authMiddleware, async (req, res) => {
  const result = await service.getById(req.user!.id, req.params.id);
  res.json(result);
});

router.put("/api/fridges/:id", authMiddleware, validateBody(updateFridgeSchema), async (req, res) => {
  const result = await service.update(req.user!.id, req.params.id, req.body);
  res.json(result);
});

router.delete("/api/fridges/:id", authMiddleware, async (req, res) => {
  await service.remove(req.user!.id, req.params.id);
  res.status(204).send();
});

export default router;
