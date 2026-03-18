import { withAuth } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";
import { createShiftGearUpNotification } from "@/lib/services/notifications";

export const POST = withAuth(async (req, { user }) => {
  if (user.role === "STUDENT") {
    throw new HttpError(403, "Staff or admin access required");
  }

  const body = await req.json();
  const assignmentId = body?.assignmentId;

  if (!assignmentId || typeof assignmentId !== "string") {
    throw new HttpError(400, "assignmentId is required");
  }

  await createShiftGearUpNotification(assignmentId);

  return ok({ success: true });
});
