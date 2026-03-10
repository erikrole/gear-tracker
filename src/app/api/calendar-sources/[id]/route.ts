export const runtime = "edge";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, ok, HttpError } from "@/lib/http";

const patchSourceSchema = z.object({
  name: z.string().min(1).optional(),
  url: z.string().url().optional(),
  enabled: z.boolean().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: "No fields to update" });

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN" && user.role !== "STAFF") {
      throw new HttpError(403, "Forbidden");
    }
    const { id } = await ctx.params;

    const source = await db.calendarSource.findUnique({ where: { id } });
    if (!source) throw new HttpError(404, "Source not found");

    const body = patchSourceSchema.parse(await req.json());
    const updated = await db.calendarSource.update({
      where: { id },
      data: body,
      include: { _count: { select: { events: true } } },
    });

    return ok({ data: updated });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN" && user.role !== "STAFF") {
      throw new HttpError(403, "Forbidden");
    }
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
