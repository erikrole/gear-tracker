import { start } from "workflow/api";
import { shiftTimeChangedNotificationsWorkflow } from "@/workflows/shift-time-changed-notifications";

export async function scheduleShiftTimeChangedNotifications(assignmentIds: string[]) {
  if (assignmentIds.length === 0) return null;

  try {
    const run = await start(shiftTimeChangedNotificationsWorkflow, [assignmentIds]);
    return run.runId;
  } catch (error) {
    console.error("[Shift] failed to schedule time-change notifications", {
      assignmentCount: assignmentIds.length,
      error,
    });
    return null;
  }
}
