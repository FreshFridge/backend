import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import { requireRole } from "../../middleware/requireRole";
import { validateBody } from "../../middleware/validateBody";
import { validateQuery } from "../../middleware/validateQuery";
import {
  listUsersQuerySchema,
  updateUserRoleSchema,
  updateUserBlockStatusSchema,
  updateSystemSettingsSchema,
  listAuditQuerySchema,
} from "./admin.validation";
import { AdminService } from "./admin.service";

const router = Router();
const service = new AdminService();

// List all users with filters
router.get(
  "/api/admin/users",
  authMiddleware,
  requireRole("admin"),
  validateQuery(listUsersQuerySchema),
  async (req, res) => {
    const result = await service.listUsers((req as any).validatedQuery);
    res.json(result);
  }
);

// Get user by ID
router.get("/api/admin/users/:id", authMiddleware, requireRole("admin"), async (req, res) => {
  const user = await service.getUserById(req.params.id);
  res.json(user);
});

// Update user role
router.patch(
  "/api/admin/users/:id/role",
  authMiddleware,
  requireRole("admin"),
  validateBody(updateUserRoleSchema),
  async (req, res) => {
    const user = await service.updateUserRole(req.user!.id, req.params.id, req.body.role);
    res.json(user);
  }
);

// Block/unblock user
router.patch(
  "/api/admin/users/:id/block",
  authMiddleware,
  requireRole("admin"),
  validateBody(updateUserBlockStatusSchema),
  async (req, res) => {
    const user = await service.updateUserBlockStatus(req.user!.id, req.params.id, req.body.is_blocked);
    res.json(user);
  }
);

// Get combined system settings (SystemSettings + TelemetryThresholds)
router.get("/api/admin/settings", authMiddleware, requireRole("admin"), async (req, res) => {
  const settings = await service.getSettings();
  res.json(settings);
});

// Update combined system settings
router.patch(
  "/api/admin/settings",
  authMiddleware,
  requireRole("admin"),
  validateBody(updateSystemSettingsSchema),
  async (req, res) => {
    const settings = await service.updateSettings(req.user!.id, req.body);
    res.json(settings);
  }
);

// List audit logs with filters
router.get(
  "/api/admin/audit",
  authMiddleware,
  requireRole("admin"),
  validateQuery(listAuditQuerySchema),
  async (req, res) => {
    const result = await service.listAuditLogs((req as any).validatedQuery);
    res.json(result);
  }
);

export default router;
