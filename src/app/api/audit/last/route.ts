import { z } from "zod";
import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { db } from "@/lib/db";
import { enforceRateLimit } from "@/lib/rate-limit";

/**
 * Entity types STAFF may query. Restricted to settings-surface types so
 * STAFF cannot probe ADMIN activity by passing entityType: "user" /
 * "session" / "kiosk_device" etc. ADMIN may query any type.
 */
const STAFF_ALLOWED_ENTITY_TYPES = new Set([
  "allowed_email",
  "location",
  "category",
  "department",
  "sport",
  "venue_mapping",
  "calendar_source",
  "kit",
  "asset",
  "bulk_sku",
  "booking",
]);

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
  await enforceRateLimit(`audit:last:${user.id}`, { max: 30, windowMs: 60_000 });

  // Coarse role gate — the audit log surfaces actor identity which is
  // admin/staff information, not for STUDENT.
  if (user.role !== "ADMIN" && user.role !== "STAFF") {
    return ok({ data: {} });
  }

  const body = bodySchema.parse(await req.json());

  // STAFF can only inspect non-sensitive entity types — block probing of
  // user/session/kiosk audit history that would reveal ADMIN activity.
  if (user.role === "STAFF" && !STAFF_ALLOWED_ENTITY_TYPES.has(body.entityType)) {
    return ok({ data: {} });
  }

  const ids = Array.from(new Set(body.entityIds));

  // Per-id findFirst against the (entityType, entityId, createdAt) index.
  // Bounds each query to one row instead of scanning every audit row for
  // the entity set.
  const rows = await Promise.all(
    ids.map((entityId) =>
      db.auditLog.findFirst({
        where: { entityType: body.entityType, entityId },
        orderBy: { createdAt: "desc" },
        select: {
          entityId: true,
          action: true,
          createdAt: true,
          actor: { select: { id: true, name: true } },
        },
      }),
    ),
  );

  const latestByEntity: Record<
    string,
    { action: string; createdAt: string; actor: { id: string; name: string } | null }
  > = {};
  for (const row of rows) {
    if (!row) continue;
    latestByEntity[row.entityId] = {
      action: row.action,
      createdAt: row.createdAt.toISOString(),
      actor: row.actor ? { id: row.actor.id, name: row.actor.name } : null,
    };
  }

  return ok({ data: latestByEntity });
});
