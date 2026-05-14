import { Role } from "@prisma/client";
import { withAuth } from "@/lib/api";
import { getAdminFixTodayQueue } from "@/lib/admin-fix-today";
import { ok } from "@/lib/http";
import { requireRole } from "@/lib/rbac";

export const GET = withAuth(async (_req, { user }) => {
  requireRole(user.role, [Role.ADMIN]);

  return ok({
    data: await getAdminFixTodayQueue(),
  });
});
