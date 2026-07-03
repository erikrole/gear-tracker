import { NextResponse } from "next/server";
import { withCron } from "@/lib/cron";
import {
  startDueCheckoutReturnLiveActivities,
  sweepOverdueCheckoutReturnLiveActivities,
} from "@/lib/services/live-activities";

export const GET = withCron(async () => {
  const [started, overdue] = await Promise.all([
    startDueCheckoutReturnLiveActivities(),
    sweepOverdueCheckoutReturnLiveActivities(),
  ]);

  return NextResponse.json({
    ok: true,
    started,
    overdue,
  });
});
