import { NextResponse } from "next/server";
import { withHandler } from "@/lib/api";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { cleanSourceSummary } from "@/lib/schedule-event-identity";
import { effectiveCallWindow } from "@/lib/shift-call-windows";

export const dynamic = "force-dynamic";

const TOKEN_RE = /^[a-f0-9]{48}$/i;
const ICS_ASSIGNMENT_LIMIT = 500;
const HISTORY_WINDOW_MS = 31 * 24 * 60 * 60 * 1000;
const FUTURE_WINDOW_MS = 366 * 24 * 60 * 60 * 1000;

/**
 * Refresh hint for subscribed clients. Apple Calendar's own default for a
 * subscription can be as slow as once a day (or whatever the user picked when
 * subscribing), which is useless for a schedule where call times move and
 * shifts get traded the morning of. Both spellings are needed: Apple honors
 * the standard `REFRESH-INTERVAL`, older clients only read `X-PUBLISHED-TTL`.
 */
const REFRESH_INTERVAL = "PT1H";
const TOKEN_LIMIT = { max: 30, windowMs: 60_000 };
const IP_LIMIT = { max: 120, windowMs: 60_000 };

function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

const ICS_FOLD_BYTES = 74;
const byteLength = (s: string) => new TextEncoder().encode(s).length;

/**
 * Fold a content line per RFC 5545 §3.1 (max 75 octets per physical line,
 * continuations start with a space). Byte-aware so multi-byte characters
 * (the 🔁 trade prefix) never split mid-codepoint.
 */
function icsFold(line: string): string[] {
  if (byteLength(line) <= ICS_FOLD_BYTES) return [line];
  const out: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const ch of line) {
    const chBytes = byteLength(ch);
    if (currentBytes + chBytes > ICS_FOLD_BYTES) {
      out.push(current);
      current = " ";
      currentBytes = 1;
    }
    current += ch;
    currentBytes += chBytes;
  }
  if (current.length > 0) out.push(current);
  return out;
}

function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function latestDate(dates: Date[]): Date {
  return new Date(Math.max(...dates.map((d) => d.getTime())));
}

export const GET = withHandler<{ token: string }>(async (req, { params }) => {
  const { token } = params;

  if (!TOKEN_RE.test(token)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const ip = getClientIp(req);
  const ipLimit = await checkRateLimit(`shifts:ics:ip:${ip}`, IP_LIMIT);
  const tokenLimit = await checkRateLimit(`shifts:ics:token:${token}`, TOKEN_LIMIT);
  if (!ipLimit.allowed || !tokenLimit.allowed) {
    const resetAt = Math.max(ipLimit.resetAt, tokenLimit.resetAt);
    const retryAfterSec = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
    return new NextResponse("Too many requests", {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    });
  }

  const user = await db.user.findFirst({ where: { icsToken: token, active: true } });
  if (!user) {
    return new NextResponse("Not found", { status: 404 });
  }

  const now = new Date();
  // Plain millisecond arithmetic, not setMonth/setFullYear: on the 29th-31st
  // `setMonth(getMonth() - 1)` overflows a short month (Mar 31 minus one month
  // lands on Mar 3), silently shrinking the history window on those days.
  const windowStart = new Date(now.getTime() - HISTORY_WINDOW_MS);
  const windowEnd = new Date(now.getTime() + FUTURE_WINDOW_MS);

  const assignments = await db.shiftAssignment.findMany({
    where: {
      userId: user.id,
      status: { in: ["DIRECT_ASSIGNED", "APPROVED"] },
      shift: {
        startsAt: { gte: windowStart, lte: windowEnd },
        // Cancelled/archived events must drop out of the VEVENT list — that
        // is how calendar apps remove them from subscribers' calendars.
        // Safe for the 1-month history window: events archive at 4 months.
        shiftGroup: { event: { status: "CONFIRMED", archivedAt: null } },
      },
    },
    include: {
      shift: {
        include: {
          shiftGroup: {
            include: {
              event: {
                select: {
                  id: true,
                  summary: true,
                  // Linked venue for home games; raw source text ("West
                  // Lafayette, IN") is the only "where" an away game carries.
                  rawLocationText: true,
                  updatedAt: true,
                  location: { select: { name: true } },
                },
              },
            },
          },
        },
      },
      trades: {
        where: { status: { in: ["OPEN", "CLAIMED"] } },
        select: { id: true, status: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { shift: { startsAt: "asc" } },
    take: ICS_ASSIGNMENT_LIMIT,
  });

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Wisconsin Creative//Shifts//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(user.name + " Shifts")}`,
    "X-WR-TIMEZONE:America/Chicago",
    `REFRESH-INTERVAL;VALUE=DURATION:${REFRESH_INTERVAL}`,
    `X-PUBLISHED-TTL:${REFRESH_INTERVAL}`,
  ];

  for (const a of assignments) {
    const shift = a.shift;
    const event = shift.shiftGroup.event;
    // Where the event happens: the linked venue when we have one, else the
    // raw source text that away games carry ("Los Angeles, CA").
    const location = event.location?.name ?? (event.rawLocationText?.trim() || undefined);
    const activeTrade = a.trades[0];
    // The full call window the worker is on the clock, resolved the same way
    // the schedule UI does: personal call times if set, else the slot's, else
    // the shift's own window. Never a per-field mix — a partial personal call
    // (start but no end) falls through to the slot rather than splicing a
    // personal start onto a slot end.
    const callWindow = effectiveCallWindow(shift, a);
    // Straight event title ("Volleyball vs Ohio State"): the source summary,
    // with result markers and the "Wisconsin Badgers" prefix stripped. No area
    // or trade decoration — this is the user's own calendar, and no user holds
    // two shifts for one event, so the plain title never collides.
    const title = cleanSourceSummary(event.summary);
    const dtStart = icsDate(new Date(callWindow.startsAt));
    const dtEnd = icsDate(new Date(callWindow.endsAt));
    const uid = `shift-${a.id}@wisconsin.creative`;
    const lastModified = latestDate([
      a.updatedAt,
      shift.updatedAt,
      event.updatedAt,
      ...(activeTrade ? [activeTrade.updatedAt] : []),
    ]);
    const dtstamp = icsDate(lastModified);
    const sequence = Math.floor(lastModified.getTime() / 1000);
    // Canonical origin, not the request's Host header — a spoofed Host must
    // not seed poisoned links into a subscribed calendar.
    const eventUrl = `${env.appUrl}/events/${event.id}`;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`LAST-MODIFIED:${dtstamp}`);
    lines.push(`SEQUENCE:${sequence}`);
    lines.push(`DTSTART:${dtStart}`);
    lines.push(`DTEND:${dtEnd}`);
    lines.push(`SUMMARY:${icsEscape(title)}`);
    if (location) lines.push(`LOCATION:${icsEscape(location)}`);
    lines.push(`URL:${eventUrl}`);
    lines.push("TRANSP:OPAQUE");
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  const body = lines.flatMap(icsFold).join("\r\n") + "\r\n";

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="shifts.ics"`,
      "Cache-Control": "no-cache, no-store",
      "X-Event-Limit": String(ICS_ASSIGNMENT_LIMIT),
    },
  });
});
