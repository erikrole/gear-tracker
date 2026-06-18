import { z } from "zod";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { createShiftGearUpNotification } from "@/lib/services/notifications";
import { createAuditEntry } from "@/lib/audit";
import { enforceRateLimit } from "@/lib/rate-limit";

const nudgeSchema = z.object({
  assignmentId: z.string().cuid(),
});

export const POST = withAuth(async (req, { user }) => {
  if (user.role === "STUDENT") {
    throw new HttpError(403, "Staff or admin access required");
  }

  // Cap nudge spam: a compromised staff account could otherwise notify
  // every user repeatedly. 20/min/actor is plenty for legitimate use.
  await enforceRateLimit(`notifications:nudge:${user.id}`, { max: 20, windowMs: 60_000 });
  await enforceRateLimit(`notifications:nudge:${user.id}:hour`, { max: 60, windowMs: 60 * 60_000 });

  const body = nudgeSchema.parse(await req.json());

  const assignment = await db.shiftAssignment.findUnique({
    where: { id: body.assignmentId },
    select: {
      id: true,
      userId: true,
      status: true,
      shift: {
        select: {
          endsAt: true,
          shiftGroup: { select: { archivedAt: true } },
        },
      },
    },
  });

  if (!assignment) {
    throw new HttpError(404, "Assignment not found");
  }
  if (assignment.status !== "DIRECT_ASSIGNED" && assignment.status !== "APPROVED") {
    throw new HttpError(409, "Only active assignments can be nudged");
  }
  if (assignment.shift.shiftGroup.archivedAt) {
    throw new HttpError(409, "Archived event assignments cannot be nudged");
  }
  if (assignment.shift.endsAt.getTime() <= Date.now()) {
    throw new HttpError(409, "Past assignments cannot be nudged");
  }

  await enforceRateLimit(`notifications:nudge:assignment:${assignment.id}`, { max: 2, windowMs: 60 * 60_000 });
  await enforceRateLimit(`notifications:nudge:recipient:${assignment.userId}`, { max: 5, windowMs: 60 * 60_000 });

  await createShiftGearUpNotification(body.assignmentId, { source: "manual_nudge" });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "shift_assignment",
    entityId: body.assignmentId,
    action: "nudge_sent",
  });

  return ok({ success: true });
});
