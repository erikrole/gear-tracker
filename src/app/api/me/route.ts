export const runtime = "edge";
import { z } from "zod";
import { requireAuth, hashPassword, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, ok, HttpError } from "@/lib/http";

export async function GET() {
  try {
    const user = await requireAuth();
    return ok({ user });
  } catch (error) {
    return fail(error);
  }
}

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.enum(["ADMIN", "STAFF", "STUDENT"]).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).max(128).optional(),
}).refine(
  (data) => {
    if (data.newPassword && !data.currentPassword) return false;
    return true;
  },
  { message: "Current password is required to set a new password" }
);

export async function PATCH(req: Request) {
  try {
    const actor = await requireAuth();
    const body = updateProfileSchema.parse(await req.json());

    const updateData: Record<string, unknown> = {};

    if (body.name) {
      updateData.name = body.name;
    }

    if (body.role) {
      updateData.role = body.role;
    }

    if (body.newPassword && body.currentPassword) {
      const fullUser = await db.user.findUnique({
        where: { id: actor.id },
      });
      if (!fullUser) {
        throw new HttpError(404, "User not found");
      }

      const valid = await verifyPassword(fullUser.passwordHash, body.currentPassword);
      if (!valid) {
        throw new HttpError(400, "Current password is incorrect");
      }

      updateData.passwordHash = await hashPassword(body.newPassword);
    }

    if (Object.keys(updateData).length === 0) {
      throw new HttpError(400, "No fields to update");
    }

    const updated = await db.user.update({
      where: { id: actor.id },
      data: updateData,
      select: { id: true, name: true, email: true, role: true },
    });

    return ok({ user: updated });
  } catch (error) {
    return fail(error);
  }
}
