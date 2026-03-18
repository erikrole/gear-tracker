import { withAuth } from "@/lib/api";
import { createAuditEntry } from "@/lib/audit";
import { HttpError, ok } from "@/lib/http";
import { db } from "@/lib/db";

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

  return ok({ rules, config: escalationConfig });
});

/**
 * PATCH /api/settings/escalation
 * Update a single escalation rule or the system config.
 * Body: { ruleId, enabled, notifyAdmins, notifyRequester } OR { maxNotificationsPerBooking }
 */
export const PATCH = withAuth(async (req, { user }) => {
  if (user.role !== "ADMIN") throw new HttpError(403, "Admin only");

  const body = await req.json();

  // Update system config
  if (body.maxNotificationsPerBooking !== undefined) {
    const cap = Number(body.maxNotificationsPerBooking);
    if (!Number.isInteger(cap) || cap < 1 || cap > 100) {
      throw new HttpError(400, "Cap must be between 1 and 100");
    }
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
  if (body.ruleId) {
    const data: Record<string, unknown> = {};
    if (body.enabled !== undefined) data.enabled = Boolean(body.enabled);
    if (body.notifyAdmins !== undefined) data.notifyAdmins = Boolean(body.notifyAdmins);
    if (body.notifyRequester !== undefined) data.notifyRequester = Boolean(body.notifyRequester);

    if (Object.keys(data).length === 0) {
      throw new HttpError(400, "No fields to update");
    }

    const beforeRule = await db.escalationRule.findUnique({ where: { id: body.ruleId } });
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
