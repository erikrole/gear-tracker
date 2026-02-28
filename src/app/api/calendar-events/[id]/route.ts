export const runtime = "edge";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, HttpError, ok } from "@/lib/http";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await ctx.params;

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
  } catch (error) {
    return fail(error);
  }
}
