import { NextRequest, NextResponse } from "next/server";
import { processOverdueNotifications } from "@/lib/services/notifications";

/**
 * GET /api/cron/notifications
 * Called by Vercel Cron every 15 minutes. Validates CRON_SECRET bearer token.
 * No user session required — runs as a system job.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processOverdueNotifications();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[CRON] Notification processing failed:", error);
    return NextResponse.json(
      { error: "Processing failed" },
      { status: 500 }
    );
  }
}
