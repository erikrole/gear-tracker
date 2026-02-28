export const runtime = "edge";
import { db } from "@/lib/db";
import { fail, HttpError, ok } from "@/lib/http";
import { hashPassword, requireAuth, verifyPassword } from "@/lib/auth";
import { changePasswordSchema, updateProfileSchema } from "@/lib/validation";

export async function GET() {
  try {
    const user = await requireAuth();

    const profile = await db.user.findUniqueOrThrow({
      where: { id: user.id },
      include: {
        location: { select: { id: true, name: true } }
      }
    });

    const locations = await db.location.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true }
    });

    return ok({
      data: {
        user: {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          role: profile.role,
          location: profile.location
        },
        locations
      }
    });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const actor = await requireAuth();
    const body = await req.json();

    if (body.action === "change_password") {
      const payload = changePasswordSchema.parse(body);
      const existing = await db.user.findUniqueOrThrow({ where: { id: actor.id } });
      const valid = await verifyPassword(existing.passwordHash, payload.currentPassword);

      if (!valid) {
        throw new HttpError(400, "Current password is incorrect");
      }

      const nextHash = await hashPassword(payload.newPassword);
      await db.user.update({
        where: { id: actor.id },
        data: { passwordHash: nextHash }
      });

      return ok({ message: "Password updated" });
    }

    const payload = updateProfileSchema.parse(body);

    const updated = await db.user.update({
      where: { id: actor.id },
      data: {
        ...(payload.name ? { name: payload.name } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, "locationId")
          ? { locationId: payload.locationId ?? null }
          : {})
      },
      include: {
        location: { select: { id: true, name: true } }
      }
    });

    return ok({
      data: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        location: updated.location
      }
    });
  } catch (error) {
    return fail(error);
  }
}
