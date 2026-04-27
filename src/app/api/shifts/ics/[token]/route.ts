import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;

  const user = await db.user.findUnique({ where: { icsToken: token } });
  if (!user) {
    return new Response("Not found", { status: 404 });
  }

  const assignments = await db.shiftAssignment.findMany({
    where: {
      userId: user.id,
      status: { in: ["DIRECT_ASSIGNED", "APPROVED"] },
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
    },
  });
}
