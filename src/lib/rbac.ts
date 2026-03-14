import { Role } from "@prisma/client";
import { HttpError } from "@/lib/http";
import { getAllowedRoles } from "@/lib/permissions";

/**
 * Require that the user's role is in the provided list.
 * Throws 403 if not authorized.
 */
export function requireRole(userRole: Role, allowed: Role[]) {
  if (!allowed.includes(userRole)) {
    throw new HttpError(403, "Forbidden");
  }
}

/**
 * Policy-based authorization: look up allowed roles from the
 * centralized permission map and enforce.
 */
export function requirePermission(userRole: Role, resource: string, action: string) {
  const allowed = getAllowedRoles(resource, action);
  if (!allowed.includes(userRole)) {
    throw new HttpError(403, "Forbidden");
  }
}
