import { z } from "zod";
import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";
import { addUnknownOccupant } from "@/lib/services/licenses";

const bodySchema = z.object({
  label: z.string().min(1, "Name is required"),
});

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "license", "manage");
  const { label } = bodySchema.parse(await req.json());
  const code = await addUnknownOccupant(params.id, label, user.id);

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "license_code",
    entityId: params.id,
    action: "occupy",
    after: { occupantLabel: label, status: code.status },
  });

  return ok({ data: code }, 201);
});
