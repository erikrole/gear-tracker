import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { syncCalendarSource } from "@/lib/services/calendar-sync";
import { generateShiftsForNewEvents } from "@/lib/services/shift-generation";
import { enforceRateLimit } from "@/lib/rate-limit";

export const POST = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "calendar_source", "sync");
  // Sync hits an external ICS URL — tighter limit than other settings writes.
  await enforceRateLimit(`calendar-sources:sync:${user.id}`, { max: 10, windowMs: 60_000 });
  const { id } = params;
  const result = await syncCalendarSource(id);

  // Post-sync: auto-generate shifts for newly synced events
  let shiftGeneration: { groupsCreated: number; shiftsCreated: number } | null = null;
  let shiftGenerationError: string | null = null;
  try {
    shiftGeneration = await generateShiftsForNewEvents(id);
  } catch (err) {
    console.error("Shift generation after sync failed:", err);
    shiftGenerationError = err instanceof Error ? err.message : "Unknown error";
  }

  // Return 200 even for partial failures — include error detail so UI can surface it
  return ok({
    data: {
      ...result,
      shiftGeneration: shiftGeneration ?? { groupsCreated: 0, shiftsCreated: 0 },
      shiftGenerationError,
    },
  });
});
