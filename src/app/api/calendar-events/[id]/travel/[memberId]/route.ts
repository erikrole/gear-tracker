import { Prisma } from "@prisma/client";
import { withAuth } from "@/lib/api";
import { createAuditEntryTx } from "@/lib/audit";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { enforceRateLimit, SETTINGS_MUTATION_LIMIT } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/rbac";

export const DELETE = withAuth<{ id: string; memberId: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "shift", "manage");
  await enforceRateLimit(`event-travel:write:${user.id}`, SETTINGS_MUTATION_LIMIT);
  const { id, memberId } = params;

  await db.$transaction(async (tx) => {
    const member = await tx.eventTravelMember.findUnique({
      where: { id: memberId },
      select: { eventId: true, userId: true, notes: true },
    });

    if (!member || member.eventId !== id) {
      throw new HttpError(404, "Travel member not found");
    }

    await tx.eventTravelMember.delete({ where: { id: memberId } });
    await createAuditEntryTx(tx, {
      actorId: user.id,
      actorRole: user.role,
      entityType: "calendar_event",
      entityId: id,
      action: "travel_member_removed",
      before: {
        travelMemberId: memberId,
        userId: member.userId,
        notes: member.notes,
      },
      after: {
        travelMemberId: memberId,
        userId: member.userId,
        removed: true,
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  return ok({ data: null });
});
