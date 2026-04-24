import { z } from "zod";
import { withAuth } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { bulkCreateCodes } from "@/lib/services/licenses";

const bulkSchema = z.object({
  codes: z.string().min(1, "Provide at least one code"),
  accountEmail: z.string().email().optional(),
  expiresAt: z.string().datetime().optional(),
});
const BULK_LIMIT = { max: 5, windowMs: 60_000 };

export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "license", "manage");
  const { allowed } = checkRateLimit(`license:bulk:${user.id}`, BULK_LIMIT);
  if (!allowed) throw new HttpError(429, "Too many requests. Please wait a moment.");
  const body = bulkSchema.parse(await req.json());
  const result = await bulkCreateCodes(body.codes, user.id, {
    accountEmail: body.accountEmail,
    expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
  });

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
