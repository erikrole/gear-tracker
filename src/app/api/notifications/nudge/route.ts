import { z } from "zod";
import { withAuth } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";
import { createShiftGearUpNotification } from "@/lib/services/notifications";
import { createAuditEntry } from "@/lib/audit";

const nudgeSchema = z.object({
  assignmentId: z.string().cuid(),
});

export const POST = withAuth(async (req, { user }) => {
  if (user.role === "STUDENT") {
    throw new HttpError(403, "Staff or admin access required");
  }

  const body = nudgeSchema.parse(await req.json());

  await createShiftGearUpNotification(body.assignmentId);

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "shift_assignment",
    entityId: body.assignmentId,
    action: "nudge_sent",
  });

  return ok({ success: true });
});
