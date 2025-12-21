import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import { validateBody } from "../../middleware/validateBody";
import { createShelfSchema, updateShelfSchema } from "./shelves.validation";
import { ShelvesService } from "./shelves.service";

const router = Router();
const service = new ShelvesService();

router.post("/api/fridges/:fridgeId/shelves", authMiddleware, validateBody(createShelfSchema), async (req, res) => {
  const result = await service.create(req.user!.id, req.params.fridgeId, req.body);
  res.status(201).json(result);
});

router.get("/api/fridges/:fridgeId/shelves", authMiddleware, async (req, res) => {
  const result = await service.listByFridge(req.user!.id, req.params.fridgeId);
  res.json(result);
});

router.get("/api/shelves/:id", authMiddleware, async (req, res) => {
  const result = await service.getById(req.user!.id, req.params.id);
  res.json(result);
});

router.put("/api/shelves/:id", authMiddleware, validateBody(updateShelfSchema), async (req, res) => {
  const result = await service.update(req.user!.id, req.params.id, req.body);
  res.json(result);
});

router.delete("/api/shelves/:id", authMiddleware, async (req, res) => {
  await service.remove(req.user!.id, req.params.id);
  res.status(204).send();
});

export default router;
