import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "asset", "retire");

  const { id } = params;
  const before = await db.asset.findUnique({ where: { id } });
  if (!before) throw new HttpError(404, "Asset not found");

  const asset = await db.asset.update({
    where: { id },
    data: { status: "RETIRED" },
    include: { location: true, category: true },
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "asset",
    entityId: id,
    action: "retired",
    before: { status: before.status },
    after: { status: "RETIRED" },
  });

  return ok({ data: asset });
});
