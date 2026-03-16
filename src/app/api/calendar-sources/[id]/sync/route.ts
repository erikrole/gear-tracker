import { requireAuth } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { syncCalendarSource } from "@/lib/services/calendar-sync";
import { generateShiftsForNewEvents } from "@/lib/services/shift-generation";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAuth();
    requirePermission(actor.role, "calendar_source", "sync");
    const { id } = await ctx.params;
    const result = await syncCalendarSource(id);

    // Post-sync: auto-generate shifts for newly synced events
    let shiftGeneration = { groupsCreated: 0, shiftsCreated: 0 };
    try {
      shiftGeneration = await generateShiftsForNewEvents(id);
    } catch (err) {
      console.error("Shift generation after sync failed:", err);
    }

    // Return 200 even for partial failures — the result contains error details
    return ok({ data: { ...result, shiftGeneration } });
  } catch (error) {
    console.error("Sync route error:", error);
    return fail(error);
  }
}
