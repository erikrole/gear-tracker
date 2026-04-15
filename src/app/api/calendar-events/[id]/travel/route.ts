import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { requirePermission, requireRole } from "@/lib/rbac";
import { z } from "zod";

const addMemberSchema = z.object({
  userId: z.string().cuid(),
  notes: z.string().trim().max(200).optional(),
});

export const GET = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requireRole(user.role, ["ADMIN", "STAFF", "STUDENT"]);
  const { id } = params;

  const members = await db.eventTravelMember.findMany({
    where: { eventId: id },
    include: {
      user: { select: { id: true, name: true, role: true, primaryArea: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return ok({ data: members });
});

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "shift", "manage");
  const { id } = params;

  const event = await db.calendarEvent.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!event) throw new HttpError(404, "Event not found");

  const body = addMemberSchema.parse(await req.json());

  const member = await db.eventTravelMember.create({
    data: {
      eventId: id,
      userId: body.userId,
      notes: body.notes ?? null,
    },
    include: {
      user: { select: { id: true, name: true, role: true, primaryArea: true, avatarUrl: true } },
    },
  });

  return ok({ data: member }, 201);
});
