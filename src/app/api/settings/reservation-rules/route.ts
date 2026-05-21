import { z } from "zod";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { createAuditEntry } from "@/lib/audit";
import { enforceRateLimit, SETTINGS_MUTATION_LIMIT } from "@/lib/rate-limit";
import { normalizeReservationRules, DEFAULT_RESERVATION_RULES } from "@/lib/services/reservation-rules";

const putSchema = z.object({
  advanceWindowDays: z.number().int().min(1).max(730).nullable(),
  noShowExpiryHours: z.number().min(1).max(336),
  maxConcurrentReservations: z.number().int().min(1).max(50).nullable(),
});

/** GET /api/settings/reservation-rules — admin only */
export const GET = withAuth(async (_req, { user }) => {
  if (user.role !== "ADMIN") throw new HttpError(403, "Admin only");
  const row = await db.systemConfig.findUnique({ where: { key: "reservation_rules" } });
  return ok({ data: normalizeReservationRules(row?.value) });
});

/** PUT /api/settings/reservation-rules — admin only */
export const PUT = withAuth(async (req, { user }) => {
  if (user.role !== "ADMIN") throw new HttpError(403, "Admin only");
  await enforceRateLimit(`reservation-rules:write:${user.id}`, SETTINGS_MUTATION_LIMIT);

  const body = putSchema.parse(await req.json());
  const existing = await db.systemConfig.findUnique({ where: { key: "reservation_rules" } });
  const before = existing ? normalizeReservationRules(existing.value) : DEFAULT_RESERVATION_RULES;

  await db.systemConfig.upsert({
    where: { key: "reservation_rules" },
    update: { value: body as unknown as object },
    create: { key: "reservation_rules", value: body as unknown as object },
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "system_config",
    entityId: "reservation_rules",
    action: "reservation_rules_updated",
    before,
    after: body,
  });

  return ok({ data: body });
});
