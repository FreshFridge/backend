import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import { validateBody } from "../../middleware/validateBody";
import { validateQuery } from "../../middleware/validateQuery";
import {
  createProductSchema,
  updateProductSchema,
  listProductsQuerySchema,
  expiringQuerySchema
} from "./products.validation";
import { ProductsService } from "./products.service";

const router = Router();
const service = new ProductsService();

router.post("/api/products", authMiddleware, validateBody(createProductSchema), async (req, res) => {
  const result = await service.create(req.user!.id, req.body);
  res.status(201).json(result);
});

router.get("/api/products", authMiddleware, validateQuery(listProductsQuerySchema), async (req, res) => {
  const result = await service.list(req.user!.id, (req as any).validatedQuery);
  res.json(result);
});

router.get("/api/products/expiring", authMiddleware, validateQuery(expiringQuerySchema), async (req, res) => {
  const result = await service.expiring(req.user!.id, (req as any).validatedQuery.days);
  res.json(result);
});

router.get("/api/products/:id", authMiddleware, async (req, res) => {
  const result = await service.getById(req.user!.id, req.params.id);
  res.json(result);
});

router.patch("/api/products/:id", authMiddleware, validateBody(updateProductSchema), async (req, res) => {
  const result = await service.update(req.user!.id, req.params.id, req.body);
  res.json(result);
});

router.delete("/api/products/:id", authMiddleware, async (req, res) => {
  await service.remove(req.user!.id, req.params.id);
  res.status(204).send();
});

export default router;
