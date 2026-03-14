export const runtime = "edge";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, HttpError, ok } from "@/lib/http";
import { requireRole } from "@/lib/rbac";
import { updateUserRoleSchema } from "@/lib/validation";
import { Prisma } from "@prisma/client";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAuth();
    requireRole(actor.role, ["ADMIN", "STAFF"]);

    const { id } = await ctx.params;
    const body = updateUserRoleSchema.parse(await req.json());

    const target = await db.user.findUnique({ where: { id } });
    if (!target) {
      throw new HttpError(404, "User not found");
    }

    if (target.id === actor.id && body.role !== actor.role) {
      throw new HttpError(400, "You cannot change your own role");
    }

    const previousRole = target.role;
    const user = await db.user.update({
      where: { id },
      data: { role: body.role }
    });

    await db.auditLog.create({
      data: {
        actorUserId: actor.id,
        entityType: "user",
        entityId: id,
        action: "role_changed",
        beforeJson: { role: previousRole } as Prisma.InputJsonValue,
        afterJson: { role: user.role } as Prisma.InputJsonValue,
      },
    });

    return ok({
      data: {
        id: user.id,
        role: user.role
      }
    });
  } catch (error) {
    return fail(error);
  }
}
