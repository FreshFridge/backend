import { z } from "zod";

export const createNotificationSchema = z.object({
  type: z.string().min(1).max(50),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  related_entity_type: z.string().max(50).nullable().optional(),
  related_entity_id: z.string().uuid().nullable().optional(),
  severity: z.enum(["INFO", "WARN", "CRITICAL"]).default("INFO"),
});

export const listNotificationsQuerySchema = z.object({
  isRead: z.enum(["true", "false"]).transform(val => val === "true").optional(),
  type: z.string().max(50).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
