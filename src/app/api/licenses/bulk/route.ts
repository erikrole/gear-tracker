import { z } from "zod";
import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";
import { bulkCreateCodes } from "@/lib/services/licenses";

const bulkSchema = z.object({
  codes: z.string().min(1, "Provide at least one code"),
});

export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "license", "manage");
  const body = bulkSchema.parse(await req.json());
  const result = await bulkCreateCodes(body.codes, user.id);

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "license_code",
    entityId: "bulk",
    action: "bulk_create",
    after: result,
  });

  return ok({ data: result }, 201);
});
