import { z } from "zod";
import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { db } from "@/lib/db";

const bodySchema = z.object({
  entityType: z.string().min(1).max(64),
  entityIds: z.array(z.string().min(1).max(64)).min(1).max(200),
});

/**
 * POST /api/audit/last
 * Resolve the most-recent audit entry for each requested entityId. Used by
 * settings surfaces that want to display inline "last edited by X · Yd ago"
 * context without rendering an audit log per row.
 *
 * Returns a map keyed by entityId. Missing entries simply omit that key.
 */
export const POST = withAuth(async (req, { user }) => {
  // Coarse role gate — the audit log surfaces actor identity which is
  // admin/staff information, not for STUDENT.
  if (user.role !== "ADMIN" && user.role !== "STAFF") {
    return ok({ data: {} });
  }

  const body = bodySchema.parse(await req.json());
  const ids = Array.from(new Set(body.entityIds));

  // Pull every matching audit row ordered newest-first, then keep the first
  // hit per entityId. The (entityType, entityId, createdAt) index in
  // schema.prisma makes this efficient even with many rows per entity.
  const rows = await db.auditLog.findMany({
    where: { entityType: body.entityType, entityId: { in: ids } },
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { id: true, name: true } } },
  });

  const latestByEntity: Record<string, { action: string; createdAt: string; actor: { id: string; name: string } | null }> = {};
  for (const row of rows) {
    if (latestByEntity[row.entityId]) continue;
    latestByEntity[row.entityId] = {
      action: row.action,
      createdAt: row.createdAt.toISOString(),
      actor: row.actor ? { id: row.actor.id, name: row.actor.name } : null,
    };
  }

  return ok({ data: latestByEntity });
});
