import { requireAuth } from "@/lib/auth";
import { cancelReservation } from "@/lib/services/bookings";
import { requireReservationAction } from "@/lib/services/booking-rules";
import { createAuditEntry } from "@/lib/audit";
import { fail, ok } from "@/lib/http";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAuth();
    const params = await ctx.params;

    await requireReservationAction(params.id, actor, "cancel");

    const result = await cancelReservation(params.id, actor.id);

    await createAuditEntry({
      actorId: actor.id,
      actorRole: actor.role,
      entityType: "booking",
      entityId: params.id,
      action: "cancel",
    });

    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
