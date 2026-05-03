import { NextFunction, Request, Response } from "express";
import { toSnakeCaseKeys } from "../utils/casing";

export function normalizeBody(req: Request, res: Response, next: NextFunction) {
  if (req.body && typeof req.body === "object") {
    req.body = toSnakeCaseKeys(req.body);
  }

  next();
}
