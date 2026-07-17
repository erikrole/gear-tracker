import { Role } from "@prisma/client";
import {
  requireCollaboratorCapability,
  type CollaboratorCapability,
} from "@/lib/collaborator-access";
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

/**
 * Preserve the default-deny role matrix while allowing a specifically named
 * collaborator capability at a reviewed route boundary.
 */
export function requirePermissionOrCollaboratorCapability(
  actor: Parameters<typeof requireCollaboratorCapability>[0],
  resource: string,
  action: string,
  capability: CollaboratorCapability,
) {
  if (actor.role === Role.COLLABORATOR) {
    requireCollaboratorCapability(actor, capability);
    return;
  }
  requirePermission(actor.role, resource, action);
}
