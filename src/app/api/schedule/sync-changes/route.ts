import { Role } from "@prisma/client";
import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requireRole } from "@/lib/rbac";
import { getLatestScheduleSyncChanges } from "@/lib/services/schedule-sync-changes";

export const GET = withAuth(async (_req, { user }) => {
  requireRole(user.role, [Role.ADMIN]);
  return ok({ data: await getLatestScheduleSyncChanges() });
});
