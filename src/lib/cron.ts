import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { withHandler } from "@/lib/api";

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function validateCronRequest(req: Request): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${cronSecret}`;
  if (!safeCompare(authHeader, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

export function withCron<P extends Record<string, string> = Record<string, string>>(
  handler: (req: Request, ctx: { params: P }) => Promise<NextResponse>,
) {
  return withHandler<P>(async (req, ctx) => {
    const authError = validateCronRequest(req);
    if (authError) return authError;
    return handler(req, ctx);
  });
}
