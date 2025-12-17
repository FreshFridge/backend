import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";
import { BadRequestError } from "../utils/errors";

export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.issues.map(i => i.message).join("; "));
    }

    (req as any).validatedQuery = parsed.data;

    next();
  };
}