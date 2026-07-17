import { createShiftScheduleNotification } from "@/lib/services/notifications";

export async function shiftTimeChangedNotificationsWorkflow(assignmentIds: string[]) {
  "use workflow";

  for (const assignmentId of assignmentIds) {
    await createShiftTimeChangedNotificationStep(assignmentId);
  }
}

async function createShiftTimeChangedNotificationStep(assignmentId: string) {
  "use step";

  await createShiftScheduleNotification(assignmentId, "shift_time_changed");
}
