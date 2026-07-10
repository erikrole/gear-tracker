import { sleep } from "workflow";
import { startCheckoutReturnLiveActivityForBooking } from "@/lib/services/live-activities";

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

  return startCheckoutReturnLiveActivityStep(bookingId, expectedEndsAtIso);
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
