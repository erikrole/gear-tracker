import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";

export const GET = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "calendar_source", "view");
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
