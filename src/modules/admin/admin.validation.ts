import { z } from "zod";

export const listUsersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  role: z.enum(["user", "admin"]).optional(),
  is_blocked: z.coerce.boolean().optional(),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(["user", "admin"]),
});

export const updateUserBlockStatusSchema = z.object({
  is_blocked: z.boolean(),
});

export const updateSystemSettingsSchema = z.object({
  expiring_soon_days: z.number().int().min(1).max(30).optional(),
  notification_cooldown_hours: z.number().int().min(1).max(168).optional(),
  min_temperature: z.number().min(-50).max(50).optional(),
  max_temperature: z.number().min(-50).max(50).optional(),
  min_humidity: z.number().min(0).max(100).optional().nullable(),
  max_humidity: z.number().min(0).max(100).optional().nullable(),
  max_door_open_seconds: z.number().int().min(1).max(3600).optional(),
});

export const listAuditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  admin_user_id: z.string().uuid().optional(),
  target_user_id: z.string().uuid().optional(),
  action: z.string().optional(),
});
