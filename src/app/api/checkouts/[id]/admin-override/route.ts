export const runtime = "edge";
import { requireAuth } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAdminOverride } from "@/lib/services/scans";
import { overrideSchema } from "@/lib/validation";

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

    return ok({ data: event }, 201);
  } catch (error) {
    return fail(error);
  }
}
