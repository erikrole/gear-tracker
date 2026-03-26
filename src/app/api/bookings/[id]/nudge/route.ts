import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { createAuditEntry } from "@/lib/audit";

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  if (user.role === "STUDENT") {
    throw new HttpError(403, "Staff or admin access required");
  }

  const booking = await db.booking.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      status: true,
      kind: true,
      endsAt: true,
      requesterUserId: true,
      requester: { select: { name: true } },
    },
  });

  if (!booking) throw new HttpError(404, "Booking not found");
  if (booking.status !== "OPEN") {
    throw new HttpError(400, "Booking is not currently open");
  }

  const isOverdue = booking.endsAt < new Date();
  if (!isOverdue) {
    throw new HttpError(400, "Booking is not overdue");
  }

  // Create in-app notification for the requester
  const hours = Math.round((Date.now() - booking.endsAt.getTime()) / 3_600_000);
  await db.notification.create({
    data: {
      userId: booking.requesterUserId,
      type: "overdue_nudge",
      title: "Overdue gear reminder",
      body: `"${booking.title}" is ${hours}h overdue. Please return the gear.`,
      payload: { bookingId: booking.id },
      dedupeKey: `nudge-${booking.id}-${new Date().toISOString().slice(0, 13)}`,
    },
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "booking",
    entityId: booking.id,
    action: "overdue_nudge_sent",
    after: { requester: booking.requester.name, overdueHours: hours },
  });

  return ok({ success: true });
});
