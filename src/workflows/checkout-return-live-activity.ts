import { sleep } from "workflow";
import {
  markCheckoutReturnLiveActivityOverdue,
  startCheckoutReturnLiveActivityForBooking,
} from "@/lib/services/live-activities";

export async function checkoutReturnLiveActivityWorkflow(
  bookingId: string,
  expectedEndsAtIso: string,
  wakeAtIso: string,
) {
  "use workflow";

  const wakeAt = new Date(wakeAtIso);
  if (wakeAt.getTime() > Date.now()) {
    await sleep(wakeAt);
  }

  const started = await startCheckoutReturnLiveActivityStep(bookingId, expectedEndsAtIso);

  // Then hold until the return time itself and flip the activity to overdue.
  // Without this the overdue alert has no caller at all: the batch sweep only
  // runs from `/api/cron/live-activities`, which is deliberately unregistered
  // because remote start is workflow-driven. Keeping both steps in one run
  // means an extend, which schedules a replacement workflow, supersedes the
  // whole sequence rather than just its first half.
  const endsAt = new Date(expectedEndsAtIso);
  if (endsAt.getTime() > Date.now()) {
    await sleep(endsAt);
  }

  const overdue = await markCheckoutReturnLiveActivityOverdueStep(bookingId, expectedEndsAtIso);

  return { started, overdue };
}

async function markCheckoutReturnLiveActivityOverdueStep(
  bookingId: string,
  expectedEndsAtIso: string,
) {
  "use step";

  return markCheckoutReturnLiveActivityOverdue({
    bookingId,
    expectedEndsAt: new Date(expectedEndsAtIso),
  });
}

async function startCheckoutReturnLiveActivityStep(
  bookingId: string,
  expectedEndsAtIso: string,
) {
  "use step";

  return startCheckoutReturnLiveActivityForBooking({
    bookingId,
    expectedEndsAt: new Date(expectedEndsAtIso),
  });
}
