import { db } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const TOKEN_RE = /^[a-f0-9]{48}$/i;
const ICS_ASSIGNMENT_LIMIT = 500;
const TOKEN_LIMIT = { max: 30, windowMs: 60_000 };
const IP_LIMIT = { max: 120, windowMs: 60_000 };

function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export async function GET(
  req: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;

  if (!TOKEN_RE.test(token)) {
    return new Response("Not found", { status: 404 });
  }

  const ip = getClientIp(req);
  const ipLimit = await checkRateLimit(`shifts:ics:ip:${ip}`, IP_LIMIT);
  const tokenLimit = await checkRateLimit(`shifts:ics:token:${token}`, TOKEN_LIMIT);
  if (!ipLimit.allowed || !tokenLimit.allowed) {
    const resetAt = Math.max(ipLimit.resetAt, tokenLimit.resetAt);
    const retryAfterSec = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
    return new Response("Too many requests", {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    });
  }

  const user = await db.user.findFirst({ where: { icsToken: token, active: true } });
  if (!user) {
    return new Response("Not found", { status: 404 });
  }

  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setMonth(windowStart.getMonth() - 1);
  const windowEnd = new Date(now);
  windowEnd.setFullYear(windowEnd.getFullYear() + 1);

  const assignments = await db.shiftAssignment.findMany({
    where: {
      userId: user.id,
      status: { in: ["DIRECT_ASSIGNED", "APPROVED"] },
      shift: {
        startsAt: { gte: windowStart, lte: windowEnd },
      },
    },
    include: {
      shift: {
        include: {
          shiftGroup: {
            include: {
              event: {
                select: { summary: true, locationId: true, location: { select: { name: true } } },
              },
            },
          },
        },
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
  ];

  for (const a of assignments) {
    const shift = a.shift;
    const event = shift.shiftGroup.event;
    const location = event.location?.name;
    const summary = `${icsEscape(event.summary)} (${shift.area})`;
    const dtStart = icsDate(shift.startsAt);
    const dtEnd = icsDate(shift.endsAt);
    const uid = `shift-${a.id}@wisconsin.creative`;
    const dtstamp = icsDate(new Date());

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART:${dtStart}`);
    lines.push(`DTEND:${dtEnd}`);
    lines.push(`SUMMARY:${summary}`);
    if (location) lines.push(`LOCATION:${icsEscape(location)}`);
    if (shift.notes) lines.push(`DESCRIPTION:${icsEscape(shift.notes)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  const body = lines.join("\r\n") + "\r\n";

  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="shifts.ics"`,
      "Cache-Control": "no-cache, no-store",
      "X-Event-Limit": String(ICS_ASSIGNMENT_LIMIT),
    },
  });
}
