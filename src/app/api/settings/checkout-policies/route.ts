import { z } from "zod";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { createAuditEntry } from "@/lib/audit";
import { enforceRateLimit, SETTINGS_MUTATION_LIMIT } from "@/lib/rate-limit";
import { normalizeCheckoutPolicies, DEFAULT_CHECKOUT_POLICIES } from "@/lib/services/checkout-policies";

const putSchema = z.object({
  defaultLoanDays: z.number().int().min(1).max(365),
  gracePeriodHours: z.number().min(0).max(168),
  maxItemsPerUser: z.number().int().min(1).max(100).nullable(),
});

/** GET /api/settings/checkout-policies — admin only */
export const GET = withAuth(async (_req, { user }) => {
  if (user.role !== "ADMIN") throw new HttpError(403, "Admin only");
  const row = await db.systemConfig.findUnique({ where: { key: "checkout_policies" } });
  return ok({ data: normalizeCheckoutPolicies(row?.value) });
});

/** PUT /api/settings/checkout-policies — admin only */
export const PUT = withAuth(async (req, { user }) => {
  if (user.role !== "ADMIN") throw new HttpError(403, "Admin only");
  await enforceRateLimit(`checkout-policies:write:${user.id}`, SETTINGS_MUTATION_LIMIT);

  const body = putSchema.parse(await req.json());
  const existing = await db.systemConfig.findUnique({ where: { key: "checkout_policies" } });
  const before = existing ? normalizeCheckoutPolicies(existing.value) : DEFAULT_CHECKOUT_POLICIES;

  await db.systemConfig.upsert({
    where: { key: "checkout_policies" },
    update: { value: body as unknown as object },
    create: { key: "checkout_policies", value: body as unknown as object },
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "system_config",
    entityId: "checkout_policies",
    action: "checkout_policies_updated",
    before,
    after: body,
  });

  return ok({ data: body });
});
