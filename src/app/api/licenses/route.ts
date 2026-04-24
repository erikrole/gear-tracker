import { z } from "zod";
import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";
import { listAllCodes, listCodes, createCode } from "@/lib/services/licenses";

const createSchema = z.object({
  code: z.string().min(4, "Code must be at least 4 characters"),
  label: z.string().optional(),
});

export const GET = withAuth(async (_req, { user }) => {
  requirePermission(user.role, "license", "view");
  const isAdmin = user.role === "ADMIN" || user.role === "STAFF";
  const codes = isAdmin ? await listAllCodes() : await listCodes();
  return ok({ data: codes });
});

export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "license", "manage");
  const body = createSchema.parse(await req.json());
  const code = await createCode(body.code, body.label, user.id);

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "license_code",
    entityId: code.id,
    action: "create",
    after: { code: code.code, label: code.label },
  });

  return ok({ data: code }, 201);
});
