import { start } from "workflow/api";
import { checkoutOverdueNotificationsWorkflow } from "@/workflows/checkout-overdue-notifications";

export async function scheduleCheckoutOverdueNotifications(args: {
  bookingId: string;
  endsAt: Date;
}) {
  const expectedEndsAtIso = args.endsAt.toISOString();
  try {
    const run = await start(checkoutOverdueNotificationsWorkflow, [
      args.bookingId,
      expectedEndsAtIso,
    ]);
    return run.runId;
  } catch (error) {
    console.error("[Checkout escalation] failed to schedule notification workflow", {
      bookingId: args.bookingId,
      expectedEndsAtIso,
      error,
    });
    return null;
  }
}
