import { Role } from "@prisma/client";
import { HttpError } from "@/lib/http";

export function requireRole(userRole: Role, allowed: Role[]) {
  if (!allowed.includes(userRole)) {
    throw new HttpError(403, "Forbidden");
  }
}
