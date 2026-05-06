import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128),
  full_name: z.string().min(2).max(255),
  locale: z.string().min(2).max(50).default("uk-UA"),
  timezone: z.string().min(2).max(50).default("Europe/Kyiv"),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128),
});

export const updateProfileSchema = z
  .object({
    full_name: z.string().min(2).max(255).optional(),
    locale: z.string().min(2).max(50).optional(),
    timezone: z.string().min(2).max(50).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one profile field is required",
  });

export const changePasswordSchema = z.object({
  old_password: z.string().min(1),
  new_password: z.string().min(6).max(128),
});
