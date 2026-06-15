import { CalendarEventStatus } from "@prisma/client";
import { withKiosk } from "@/lib/api";
import { db } from "@/lib/db";
import { ok } from "@/lib/http";

const KIOSK_EVENT_WINDOW_DAYS = 7;

export const GET = withKiosk(async () => {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + KIOSK_EVENT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const events = await db.calendarEvent.findMany({
    where: {
      startsAt: { lte: windowEnd },
      endsAt: { gte: now },
      status: { not: CalendarEventStatus.CANCELLED },
      isHidden: false,
      archivedAt: null,
    },
    orderBy: { startsAt: "asc" },
    take: 80,
    select: {
      id: true,
      summary: true,
      subtitle: true,
      rawLocationText: true,
      sportCode: true,
      startsAt: true,
      endsAt: true,
      allDay: true,
    },
  });

  return ok({
    data: events.map((event) => ({
      id: event.id,
      title: event.summary,
      subtitle: event.subtitle,
      sportCode: event.sportCode,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      allDay: event.allDay,
      locationName: event.rawLocationText,
    })),
  });
});
