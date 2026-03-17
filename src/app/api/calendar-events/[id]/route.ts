import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";

export const GET = withAuth<{ id: string }>(async (_req, { params }) => {
  const { id } = params;

  const event = await db.calendarEvent.findUnique({
    where: { id },
    include: {
      location: { select: { id: true, name: true } },
      source: { select: { id: true, name: true } }
    }
  });

  if (!event) {
    throw new HttpError(404, "Event not found");
  }

  return ok({ data: event });
});
