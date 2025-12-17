import { z } from "zod";

export const createProductSchema = z.object({
  fridge_id: z.string().uuid().nullable().optional(),
  shelf_id: z.string().uuid().nullable().optional(),
  category_id: z.string().uuid(),
  name: z.string().min(2).max(255),
  quantity: z.number().positive().nullable().optional(),
  unit: z.string().max(50).nullable().optional(),
  purchase_date: z.string().date().nullable().optional(),     // "YYYY-MM-DD"
  expiration_date: z.string().date().nullable().optional(),   // "YYYY-MM-DD"
  status: z.enum(["active", "consumed", "expired", "removed"]).default("active"),
  notes: z.string().max(500).nullable().optional(),
});

export const updateProductSchema = createProductSchema.partial();

export const listProductsQuerySchema = z.object({
  status: z.string().optional(),
  fridgeId: z.string().uuid().optional(),
  shelfId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["created_at", "expiration_date", "name"]).default("created_at"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export const expiringQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(60).default(3),
});
