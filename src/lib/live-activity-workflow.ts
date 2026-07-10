import { start } from "workflow/api";
import { checkoutReturnLiveActivityWorkflow } from "@/workflows/checkout-return-live-activity";

const LIVE_ACTIVITY_LEAD_MS = 30 * 60_000;

export async function scheduleCheckoutReturnLiveActivity(args: {
  bookingId: string;
  endsAt: Date;
}) {
  const expectedEndsAtIso = args.endsAt.toISOString();
  const wakeAtIso = new Date(args.endsAt.getTime() - LIVE_ACTIVITY_LEAD_MS).toISOString();

  try {
    const run = await start(checkoutReturnLiveActivityWorkflow, [
      args.bookingId,
      expectedEndsAtIso,
      wakeAtIso,
    ]);
    return run.runId;
  } catch (error) {
    console.error("[LiveActivity] failed to schedule checkout return activity", {
      bookingId: args.bookingId,
      expectedEndsAtIso,
      error,
    });
    return null;
  }
}
