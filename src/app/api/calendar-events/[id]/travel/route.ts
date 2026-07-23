import { Prisma } from "@prisma/client";
import { withAuth } from "@/lib/api";
import { createAuditEntryTx } from "@/lib/audit";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { enforceRateLimit, SETTINGS_MUTATION_LIMIT } from "@/lib/rate-limit";
import { requirePermission, requireRole } from "@/lib/rbac";
import { z } from "zod";

const addMemberSchema = z.object({
  userId: z.string().cuid(),
  notes: z.string().trim().max(200).optional(),
});

export const GET = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requireRole(user.role, ["ADMIN", "STAFF", "STUDENT"]);
  const { id } = params;

  const event = await db.calendarEvent.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!event) throw new HttpError(404, "Event not found");

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
  await enforceRateLimit(`event-travel:write:${user.id}`, SETTINGS_MUTATION_LIMIT);
  const { id } = params;
  const body = addMemberSchema.parse(await req.json());

  let member;
  try {
    member = await db.$transaction(async (tx) => {
      const event = await tx.calendarEvent.findUnique({
        where: { id },
        select: { id: true, sportCode: true },
      });
      if (!event) throw new HttpError(404, "Event not found");
      if (!event.sportCode) {
        throw new HttpError(409, "Add a sport to this event before adding travelers");
      }

      const rosterAssignment = await tx.studentSportAssignment.findUnique({
        where: {
          userId_sportCode: {
            userId: body.userId,
            sportCode: event.sportCode,
          },
        },
        select: {
          id: true,
          user: { select: { active: true } },
        },
      });
      if (!rosterAssignment?.user.active) {
        throw new HttpError(409, "Traveler must be an active member of this event's sport roster");
      }

      const created = await tx.eventTravelMember.create({
        data: {
          eventId: id,
          userId: body.userId,
          notes: body.notes ?? null,
        },
        include: {
          user: { select: { id: true, name: true, role: true, primaryArea: true, avatarUrl: true } },
        },
      });

      await createAuditEntryTx(tx, {
        actorId: user.id,
        actorRole: user.role,
        entityType: "calendar_event",
        entityId: id,
        action: "travel_member_added",
        after: {
          travelMemberId: created.id,
          userId: created.userId,
          notes: created.notes,
          sportCode: event.sportCode,
        },
      });

      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new HttpError(409, "This person is already on the travel roster");
    }
    throw error;
  }

  return ok({ data: member }, 201);
});
