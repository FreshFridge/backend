import { z } from "zod";

export const createIotDeviceSchema = z.object({
  fridge_id: z.string().uuid(),
  name: z.string().trim().min(1).max(255).optional(),
});