import { z } from "zod";

export const createFridgeSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(500).nullable().optional(),
});

export const updateFridgeSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(500).nullable().optional(),
});
