import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";
import { BadRequestError } from "../utils/errors";
import { toSnakeCaseKeys } from "../utils/casing";

export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse({
      ...req.query,
      ...(toSnakeCaseKeys(req.query) as Record<string, unknown>),
    });
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.issues.map(i => i.message).join("; "));
    }

    (req as any).validatedQuery = parsed.data;

    next();
  };
}
