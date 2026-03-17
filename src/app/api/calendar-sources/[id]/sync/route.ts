import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { syncCalendarSource } from "@/lib/services/calendar-sync";
import { generateShiftsForNewEvents } from "@/lib/services/shift-generation";

export const POST = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "calendar_source", "sync");
  const { id } = params;
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
});
