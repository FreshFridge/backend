import { NextFunction, Request, Response } from "express";
import { toCamelCaseKeys } from "../utils/casing";

export function responseFormatter(req: Request, res: Response, next: NextFunction) {
  const json = res.json.bind(res);

  res.json = (body?: unknown) => json(toCamelCaseKeys(body));

  next();
}
