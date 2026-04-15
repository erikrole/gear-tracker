import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { z } from "zod";

const schema = z.object({
  attended: z.boolean().nullable(),
});

export const PATCH = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "shift_assignment", "assign");
  const { id } = params;

  const { attended } = schema.parse(await req.json());

  const existing = await db.shiftAssignment.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) throw new HttpError(404, "Assignment not found");

  const updated = await db.shiftAssignment.update({
    where: { id },
    data: { attended },
    select: { id: true, attended: true },
  });

  return ok({ data: updated });
});
