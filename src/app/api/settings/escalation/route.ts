import { requireAuth } from "@/lib/auth";
import { fail, ok, HttpError } from "@/lib/http";
import { db } from "@/lib/db";

/**
 * GET /api/settings/escalation
 * Returns escalation rules and system config. Admin only.
 */
export async function GET() {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN") throw new HttpError(403, "Admin only");

    const [rules, config] = await Promise.all([
      db.escalationRule.findMany({ orderBy: { sortOrder: "asc" } }),
      db.systemConfig.findUnique({ where: { key: "escalation" } }),
    ]);

    const escalationConfig = (config?.value as { maxNotificationsPerBooking?: number } | null) ?? {
      maxNotificationsPerBooking: 10,
    };

    return ok({ rules, config: escalationConfig });
  } catch (error) {
    return fail(error);
  }
}

/**
 * PATCH /api/settings/escalation
 * Update a single escalation rule or the system config.
 * Body: { ruleId, enabled, notifyAdmins, notifyRequester } OR { maxNotificationsPerBooking }
 */
export async function PATCH(req: Request) {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN") throw new HttpError(403, "Admin only");

    const body = await req.json();

    // Update system config
    if (body.maxNotificationsPerBooking !== undefined) {
      const cap = Number(body.maxNotificationsPerBooking);
      if (!Number.isInteger(cap) || cap < 1 || cap > 100) {
        throw new HttpError(400, "Cap must be between 1 and 100");
      }
      await db.systemConfig.upsert({
        where: { key: "escalation" },
        update: { value: { maxNotificationsPerBooking: cap } },
        create: { key: "escalation", value: { maxNotificationsPerBooking: cap } },
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

      const rule = await db.escalationRule.update({
        where: { id: body.ruleId },
        data,
      });
      return ok(rule);
    }

    throw new HttpError(400, "Provide ruleId or maxNotificationsPerBooking");
  } catch (error) {
    return fail(error);
  }
}
