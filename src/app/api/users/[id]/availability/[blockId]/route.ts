import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { requireRole } from "@/lib/rbac";

export const DELETE = withAuth<{ id: string; blockId: string }>(async (_req, { user, params }) => {
  requireRole(user.role, ["ADMIN", "STAFF", "STUDENT"]);
  const { id, blockId } = params;

  if (user.role === "STUDENT" && user.id !== id) {
    throw new HttpError(403, "Forbidden");
  }

  const block = await db.studentAvailabilityBlock.findUnique({
    where: { id: blockId },
    select: { userId: true },
  });

  if (!block) throw new HttpError(404, "Block not found");
  if (block.userId !== id) throw new HttpError(404, "Block not found");

  await db.studentAvailabilityBlock.delete({ where: { id: blockId } });

  return ok({ data: null });
});
