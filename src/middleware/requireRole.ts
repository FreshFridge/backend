import { Request, Response, NextFunction } from "express";
import { ForbiddenError } from "../utils/errors";

/**
 * Middleware factory that checks if the authenticated user has the required role.
 * Must be used after authMiddleware.
 *
 * @param roles - Single role or array of allowed roles (e.g., "admin" or ["admin", "moderator"])
 * @returns Express middleware function
 *
 * @example
 * router.get("/admin/users", authMiddleware, requireRole("admin"), handler);
 */
export function requireRole(roles: string | string[]) {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ForbiddenError("Authentication required");
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError(`Access denied. Required role: ${allowedRoles.join(" or ")}`);
    }

    next();
  };
}
