import { z } from "zod";
import { withAuth } from "@/lib/api";
import { createAuditEntry } from "@/lib/audit";
import { HttpError, ok } from "@/lib/http";
import { db } from "@/lib/db";
import { enforceRateLimit, SETTINGS_MUTATION_LIMIT } from "@/lib/rate-limit";

const patchEscalationSchema = z.union([
  z.object({
    maxNotificationsPerBooking: z.number().int().min(1).max(100),
  }),
  z.object({
    ruleId: z.string().cuid(),
    enabled: z.boolean().optional(),
    notifyAdmins: z.boolean().optional(),
    notifyRequester: z.boolean().optional(),
  }).refine(
    (d) => d.enabled !== undefined || d.notifyAdmins !== undefined || d.notifyRequester !== undefined,
    { message: "Provide at least one field to update" }
  ),
]);

/**
 * GET /api/settings/escalation
 * Returns escalation rules and system config. Admin only.
 */
export const GET = withAuth(async (_req, { user }) => {
  if (user.role !== "ADMIN") throw new HttpError(403, "Admin only");

  const [rules, config] = await Promise.all([
    db.escalationRule.findMany({ orderBy: { sortOrder: "asc" } }),
    db.systemConfig.findUnique({ where: { key: "escalation" } }),
  ]);

  const escalationConfig = (config?.value as { maxNotificationsPerBooking?: number } | null) ?? {
    maxNotificationsPerBooking: 10,
  };

  return ok({ data: { rules, config: escalationConfig } });
});

/**
 * PATCH /api/settings/escalation
 * Update a single escalation rule or the system config.
 * Body: { ruleId, enabled, notifyAdmins, notifyRequester } OR { maxNotificationsPerBooking }
 */
export const PATCH = withAuth(async (req, { user }) => {
  if (user.role !== "ADMIN") throw new HttpError(403, "Admin only");
  await enforceRateLimit(`escalation:write:${user.id}`, SETTINGS_MUTATION_LIMIT);

  const body = patchEscalationSchema.parse(await req.json());

  // Update system config
  if ("maxNotificationsPerBooking" in body) {
    const cap = body.maxNotificationsPerBooking;
    const existing = await db.systemConfig.findUnique({ where: { key: "escalation" } });
    const before = existing?.value as Record<string, unknown> | null;
    await db.systemConfig.upsert({
      where: { key: "escalation" },
      update: { value: { maxNotificationsPerBooking: cap } },
      create: { key: "escalation", value: { maxNotificationsPerBooking: cap } },
    });
    await createAuditEntry({
      actorId: user.id,
      actorRole: user.role,
      entityType: "system_config",
      entityId: "escalation",
      action: "escalation_config_updated",
      before: before ?? undefined,
      after: { maxNotificationsPerBooking: cap },
    });
    return ok({ maxNotificationsPerBooking: cap });
  }

  // Update a rule
  if ("ruleId" in body) {
    const data: Record<string, boolean> = {};
    if (body.enabled !== undefined) data.enabled = body.enabled;
    if (body.notifyAdmins !== undefined) data.notifyAdmins = body.notifyAdmins;
    if (body.notifyRequester !== undefined) data.notifyRequester = body.notifyRequester;

    const beforeRule = await db.escalationRule.findUnique({ where: { id: body.ruleId } });
    if (!beforeRule) throw new HttpError(404, "Escalation rule not found");
    const rule = await db.escalationRule.update({
      where: { id: body.ruleId },
      data,
    });
    await createAuditEntry({
      actorId: user.id,
      actorRole: user.role,
      entityType: "escalation_rule",
      entityId: body.ruleId,
      action: "escalation_rule_updated",
      before: beforeRule ? { enabled: beforeRule.enabled, notifyAdmins: beforeRule.notifyAdmins, notifyRequester: beforeRule.notifyRequester } : undefined,
      after: data,
    });
    return ok(rule);
  }

  throw new HttpError(400, "Provide ruleId or maxNotificationsPerBooking");
});
