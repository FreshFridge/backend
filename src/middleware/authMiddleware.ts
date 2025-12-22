import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { UnauthorizedError } from "../utils/errors";
import { poolPromise, sql } from "../db/mssql";

export type AuthUser = { id: string; email: string; role: string };

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing Authorization header");
  }

  const token = header.slice("Bearer ".length);

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as AuthUser;

    // Check if user is blocked
    const pool = await poolPromise;
    const res = await pool
      .request()
      .input("id", sql.UniqueIdentifier, payload.id)
      .query("SELECT is_blocked FROM Users WHERE id = @id");

    if (res.recordset[0]?.is_blocked) {
      throw new UnauthorizedError("User is blocked");
    }

    req.user = { id: payload.id, email: payload.email, role: payload.role };
    next();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      throw err;
    }
    throw new UnauthorizedError("Invalid or expired token");
  }
}
