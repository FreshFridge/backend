import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import { validateBody } from "../../middleware/validateBody";
import { validateQuery } from "../../middleware/validateQuery";
import { createNotificationSchema, listNotificationsQuerySchema } from "./notifications.validation";
import { NotificationsService } from "./notifications.service";

const router = Router();
const service = new NotificationsService();

// Create notification (for testing/admin purposes)
router.post("/api/notifications", authMiddleware, validateBody(createNotificationSchema), async (req, res) => {
  const result = await service.create(req.user!.id, req.body);
  res.status(201).json(result);
});

// List notifications with filters
router.get("/api/notifications", authMiddleware, validateQuery(listNotificationsQuerySchema), async (req, res) => {
  const result = await service.list(req.user!.id, (req as any).validatedQuery);
  res.json(result);
});

// Get single notification
router.get("/api/notifications/:id", authMiddleware, async (req, res) => {
  const result = await service.getById(req.user!.id, req.params.id);
  res.json(result);
});

// Mark single notification as read
router.patch("/api/notifications/:id/read", authMiddleware, async (req, res) => {
  const result = await service.markRead(req.user!.id, req.params.id);
  res.json(result);
});

// Mark all notifications as read
router.patch("/api/notifications/read-all", authMiddleware, async (req, res) => {
  const count = await service.markAllRead(req.user!.id);
  res.json({ updated: count });
});

// Soft delete notification
router.delete("/api/notifications/:id", authMiddleware, async (req, res) => {
  await service.remove(req.user!.id, req.params.id);
  res.status(204).send();
});

export default router;
