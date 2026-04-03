import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";

export const PATCH = withAuth(async (req, { user, params }) => {
  if (user.role !== "ADMIN" && user.role !== "STAFF") {
    throw new HttpError(403, "Only staff and admins can hide events");
  }

  const { id } = await params;
  const body = await req.json();
  const isHidden = body.isHidden === true;

  const event = await db.calendarEvent.update({
    where: { id },
    data: { isHidden },
    select: { id: true, isHidden: true, summary: true },
  });

  return ok({ data: event });
});
