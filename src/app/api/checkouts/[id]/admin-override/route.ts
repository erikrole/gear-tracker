import { requireAuth } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAdminOverride } from "@/lib/services/scans";
import { overrideSchema } from "@/lib/validation";
import { createAuditEntry } from "@/lib/audit";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAuth();
    requirePermission(actor.role, "checkout", "admin_override");
    const params = await ctx.params;
    const body = overrideSchema.parse(await req.json());

    const event = await createAdminOverride({
      bookingId: params.id,
      actorUserId: actor.id,
      actorRole: actor.role,
      reason: body.reason,
      details: body.details
    });

    await createAuditEntry({
      actorId: actor.id,
      actorRole: actor.role,
      entityType: "booking",
      entityId: params.id,
      action: "admin_override",
      after: { reason: body.reason },
    });

    return ok({ data: event }, 201);
  } catch (error) {
    return fail(error);
  }
}
