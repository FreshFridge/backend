import { NextFunction, Request, Response } from "express";
import { NotFoundError } from "../utils/errors";

export function notFoundHandler(req: Request, res: Response, next: NextFunction) {
  next(new NotFoundError(`Route not found: ${req.method} ${req.path}`));
}
