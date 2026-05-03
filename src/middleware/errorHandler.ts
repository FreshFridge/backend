import { Request, Response, NextFunction } from "express";
import { HttpError } from "../utils/errors";
import { logger } from "../utils/logger";

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, statusCode: err.status });
  }

  logger.error("Unhandled request error", {
    method: req.method,
    path: req.path,
    error: err instanceof Error ? err.message : String(err),
  });

  return res.status(500).json({ error: "Internal Server Error", statusCode: 500 });
}
