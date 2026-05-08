import { Prisma } from "@prisma/client";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntryTx } from "@/lib/audit";

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "asset", "retire");

  const { id } = params;
  const asset = await db.$transaction(async (tx) => {
    const before = await tx.asset.findUnique({ where: { id } });
    if (!before) throw new HttpError(404, "Asset not found");

    const updated = await tx.asset.update({
      where: { id },
      data: { status: "RETIRED" },
      include: { location: true, category: true },
    });

    await createAuditEntryTx(tx, {
      actorId: user.id,
      actorRole: user.role,
      entityType: "asset",
      entityId: id,
      action: "retired",
      before: { status: before.status },
      after: { status: "RETIRED" },
    });

    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  return ok({ data: asset });
});
