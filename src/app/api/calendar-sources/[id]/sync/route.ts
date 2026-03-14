export const runtime = "edge";
import { requireAuth } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { syncCalendarSource } from "@/lib/services/calendar-sync";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAuth();
    requirePermission(actor.role, "calendar_source", "sync");
    const { id } = await ctx.params;
    const result = await syncCalendarSource(id);
    // Return 200 even for partial failures — the result contains error details
    return ok({ data: result });
  } catch (error) {
    console.error("Sync route error:", error);
    return fail(error);
  }
}
