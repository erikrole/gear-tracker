import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";
import { z } from "zod";

const addBulkMemberSchema = z.object({
  bulkSkuId: z.string().min(1),
  quantity: z.number().int().min(1).max(999),
});

const updateBulkMemberSchema = z.object({
  quantity: z.number().int().min(1).max(999),
});

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "kit", "edit");
  const body = addBulkMemberSchema.parse(await req.json());

  const kit = await db.kit.findUnique({ where: { id: params.id } });
  if (!kit) throw new HttpError(404, "Kit not found");

  const membership = await db.kitBulkMembership.upsert({
    where: { kitId_bulkSkuId: { kitId: params.id, bulkSkuId: body.bulkSkuId } },
    create: { kitId: params.id, bulkSkuId: body.bulkSkuId, quantity: body.quantity },
    update: { quantity: body.quantity },
    include: { bulkSku: { select: { id: true, name: true, category: true, unit: true, imageUrl: true } } },
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "kit",
    entityId: params.id,
    action: "bulk_member_added",
    after: { bulkSkuId: body.bulkSkuId, quantity: body.quantity },
  });

  return ok({ data: membership }, 201);
});

export const DELETE = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "kit", "edit");
  const { searchParams } = new URL(req.url);
  const membershipId = searchParams.get("membershipId");
  if (!membershipId) throw new HttpError(400, "membershipId required");

  await db.kitBulkMembership.delete({ where: { id: membershipId } });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "kit",
    entityId: params.id,
    action: "bulk_member_removed",
    after: { membershipId },
  });

  return ok({ success: true });
});
