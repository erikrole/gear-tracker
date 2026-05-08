import { NextResponse } from "next/server";
import { withCron } from "@/lib/cron";
import { processOverdueNotifications } from "@/lib/services/notifications";
import { processLicenseNags, processExpiryWarnings } from "@/lib/services/licenses";

/**
 * GET /api/cron/notifications
 * Called by Vercel Cron daily at 8:00 AM UTC (see vercel.json). Validates CRON_SECRET bearer token.
 * No user session required — runs as a system job.
 */
export const GET = withCron(async () => {
  const [overdueResult, licenseNagResult, expiryResult] = await Promise.all([
    processOverdueNotifications(),
    processLicenseNags(),
    processExpiryWarnings(),
  ]);
  return NextResponse.json({
    ok: true,
    ...overdueResult,
    licenseNags: licenseNagResult,
    licenseExpiry: expiryResult,
  });
});
