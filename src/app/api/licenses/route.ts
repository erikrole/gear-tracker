import { z } from "zod";
import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";
import { listAllCodes, listCodes, createCode } from "@/lib/services/licenses";

const createSchema = z.object({
  code: z.string().min(4, "Code must be at least 4 characters"),
  label: z.string().optional(),
  accountEmail: z.string().email().optional(),
  expiresAt: z.string().datetime().optional(),
});

export const GET = withAuth(async (_req, { user }) => {
  requirePermission(user.role, "license", "view");
  const isAdmin = user.role === "ADMIN" || user.role === "STAFF";
  const codes = isAdmin ? await listAllCodes() : await listCodes();

  // Strip the code string from rows the requester does not hold.
  // Admins/staff see everything; students only see their own held code.
  // Defense in depth — client also masks visually.
  if (!isAdmin) {
    const sanitized = codes.map((c) => {
      const isHolder = c.claims.some((claim) => claim.userId === user.id);
      return isHolder ? c : { ...c, code: "" };
    });
    return ok({ data: sanitized });
  }

  return ok({ data: codes });
});

export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "license", "manage");
  const body = createSchema.parse(await req.json());
  const code = await createCode(
    body.code,
    body.label,
    user.id,
    body.accountEmail,
    body.expiresAt ? new Date(body.expiresAt) : undefined
  );

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
