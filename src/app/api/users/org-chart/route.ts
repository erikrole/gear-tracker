import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok } from "@/lib/http";
import { requireRole } from "@/lib/rbac";

export const GET = withAuth(async (_req, { user }) => {
  requireRole(user.role, ["ADMIN", "STAFF", "STUDENT"]);

  const rows = await db.user.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      role: true,
      avatarUrl: true,
      title: true,
      primaryArea: true,
      directReportId: true,
      directReportName: true,
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  return ok({
    data: rows.map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role,
      avatarUrl: u.avatarUrl ?? null,
      title: u.title ?? null,
      primaryArea: u.primaryArea ?? null,
      directReportId: u.directReportId ?? null,
      directReportName: u.directReportName ?? null,
    })),
  });
});
