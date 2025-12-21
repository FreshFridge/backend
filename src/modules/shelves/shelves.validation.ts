import { z } from "zod";

export const createShelfSchema = z.object({
  name: z.string().min(1).max(255),
  position: z.number().int().nullable().optional(),
});

export const updateShelfSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  position: z.number().int().nullable().optional(),
});
