import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { withHandler } from "@/lib/api";
import { processOverdueNotifications } from "@/lib/services/notifications";
import { processLicenseNags, processExpiryWarnings } from "@/lib/services/licenses";

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * GET /api/cron/notifications
 * Called by Vercel Cron daily at 8:00 AM UTC (see vercel.json). Validates CRON_SECRET bearer token.
 * No user session required — runs as a system job.
 */
export const GET = withHandler(async (req) => {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }

  if (!authHeader || !safeCompare(authHeader, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
