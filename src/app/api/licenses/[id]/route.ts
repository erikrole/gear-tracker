import { z } from "zod";
import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";
import { deleteCode, retireCode, updateCodeLabel } from "@/lib/services/licenses";

const patchSchema = z.object({
  label: z.string().optional(),
  retire: z.boolean().optional(),
});

export const PATCH = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "license", "manage");
  const body = patchSchema.parse(await req.json());

  if (body.retire) {
    const code = await retireCode(params.id);
    await createAuditEntry({
      actorId: user.id,
      actorRole: user.role,
      entityType: "license_code",
      entityId: params.id,
      action: "retire",
      after: { status: code.status },
    });
    return ok({ data: code });
  }

  const code = await updateCodeLabel(params.id, body.label);
  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "license_code",
    entityId: params.id,
    action: "update",
    after: { label: code.label },
  });
  return ok({ data: code });
});

export const DELETE = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "license", "manage");
  await deleteCode(params.id);
  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "license_code",
    entityId: params.id,
    action: "delete",
  });
  return ok({ data: null });
});
