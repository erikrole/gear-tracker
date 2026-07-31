import { NextResponse } from "next/server";
import { withCron } from "@/lib/cron";
import {
  retryPendingCheckoutReturnLiveActivityEnds,
  startDueCheckoutReturnLiveActivities,
  sweepOverdueCheckoutReturnLiveActivities,
} from "@/lib/services/live-activities";

export const GET = withCron(async () => {
  const [started, overdue, pendingEnds] = await Promise.all([
    startDueCheckoutReturnLiveActivities({ limit: 5 }),
    sweepOverdueCheckoutReturnLiveActivities({ limit: 5 }),
    retryPendingCheckoutReturnLiveActivityEnds({ limit: 50 }),
  ]);

  return NextResponse.json({
    ok: true,
    started,
    overdue,
    pendingEnds,
  });
});
