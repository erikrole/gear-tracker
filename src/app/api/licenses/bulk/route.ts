import { z } from "zod";
import { withAuth } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { bulkCreateCodes, bulkRenewCodes } from "@/lib/services/licenses";

const bulkSchema = z.object({
  codes: z.string().min(1, "Provide at least one code").max(50_000, "Paste at most 50,000 characters of codes at once"),
  accountEmail: z.string().email().optional(),
  expiresAt: z.string().datetime().optional(),
});
const bulkRenewSchema = z.object({
  action: z.literal("renew"),
  ids: z.array(z.string().min(1)).min(1, "Select at least one license").max(200, "Renew at most 200 licenses at once"),
  expiresAt: z.string().datetime(),
});
const BULK_LIMIT = { max: 5, windowMs: 60_000 };

export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "license", "manage");
  const { allowed } = await checkRateLimit(`license:bulk:${user.id}`, BULK_LIMIT);
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

export const PATCH = withAuth(async (req, { user }) => {
  requirePermission(user.role, "license", "manage");
  const { allowed } = await checkRateLimit(`license:bulk-renew:${user.id}`, BULK_LIMIT);
  if (!allowed) throw new HttpError(429, "Too many requests. Please wait a moment.");

  const body = bulkRenewSchema.parse(await req.json());
  const result = await bulkRenewCodes(body.ids, new Date(body.expiresAt));

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "license_code",
    entityId: "bulk",
    action: "bulk_renew",
    after: { ...result, expiresAt: body.expiresAt },
  });

  return ok({ data: result });
});
