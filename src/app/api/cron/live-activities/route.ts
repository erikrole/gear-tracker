import { NextResponse } from "next/server";
import { withCron } from "@/lib/cron";
import { startDueCheckoutReturnLiveActivities } from "@/lib/services/live-activities";

export const GET = withCron(async () => {
  const result = await startDueCheckoutReturnLiveActivities();

  return NextResponse.json({
    ok: true,
    ...result,
  });
});
