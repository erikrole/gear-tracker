export const runtime = "edge";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, ok, HttpError } from "@/lib/http";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await ctx.params;

    const source = await db.calendarSource.findUnique({ where: { id } });
    if (!source) throw new HttpError(404, "Source not found");

    // Nullify eventId on any bookings linked to this source's events
    // so the cascade delete of events doesn't violate FK constraints
    await db.booking.updateMany({
      where: { event: { sourceId: id } },
      data: { eventId: null },
    });

    // Cascade deletes associated CalendarEvent rows (schema onDelete: Cascade)
    await db.calendarSource.delete({ where: { id } });

    return ok({ deleted: true });
  } catch (error) {
    return fail(error);
  }
}
