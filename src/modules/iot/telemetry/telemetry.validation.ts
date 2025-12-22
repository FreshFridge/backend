import { z } from "zod";

export const createTelemetrySchema = z.object({
  fridge_id: z.string().uuid(),
  temperature: z.number().min(-50).max(100),
  humidity: z.number().min(0).max(100).nullable().optional(),
  door_open: z.boolean(),
});

export const listTelemetryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
