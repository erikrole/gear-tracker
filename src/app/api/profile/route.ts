import { z } from "zod";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { changePasswordSchema, updateProfileSchema } from "@/lib/validation";
import { createAuditEntry } from "@/lib/audit";

const profilePatchSchema = z.union([
  changePasswordSchema.extend({ action: z.literal("change_password") }),
  updateProfileSchema,
]);

export const GET = withAuth(async (_req, { user }) => {
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
        avatarUrl: profile.avatarUrl ?? null,
        location: profile.location
      },
      locations
    }
  });
});

export const PATCH = withAuth(async (req, { user }) => {
  let body: z.infer<typeof profilePatchSchema>;
  try {
    body = profilePatchSchema.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw new HttpError(400, err.issues.map((e) => e.message).join(", "));
    }
    throw err;
  }

  if ("action" in body && body.action === "change_password") {
    const payload = body;
    const existing = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    const valid = await verifyPassword(existing.passwordHash, payload.currentPassword);

    if (!valid) {
      throw new HttpError(400, "Current password is incorrect");
    }

    const nextHash = await hashPassword(payload.newPassword);
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: nextHash }
    });

    await createAuditEntry({
      actorId: user.id,
      actorRole: user.role,
      entityType: "user",
      entityId: user.id,
      action: "password_change",
    });

    return ok({ message: "Password updated" });
  }

  const payload = body as z.infer<typeof updateProfileSchema>;

  const current = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { name: true, phone: true, locationId: true },
  });

  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      ...(payload.name ? { name: payload.name } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, "phone")
        ? { phone: payload.phone ?? null }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, "locationId")
        ? { locationId: payload.locationId ?? null }
        : {})
    },
    include: {
      location: { select: { id: true, name: true } }
    }
  });

  const beforeDiff: Record<string, unknown> = {};
  const afterDiff: Record<string, unknown> = {};
  if (payload.name && payload.name !== current.name) {
    beforeDiff.name = current.name;
    afterDiff.name = payload.name;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "phone") && payload.phone !== current.phone) {
    beforeDiff.phone = current.phone;
    afterDiff.phone = payload.phone ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "locationId") && payload.locationId !== current.locationId) {
    beforeDiff.locationId = current.locationId;
    afterDiff.locationId = payload.locationId ?? null;
  }

  if (Object.keys(afterDiff).length > 0) {
    await createAuditEntry({
      actorId: user.id,
      actorRole: user.role,
      entityType: "user",
      entityId: user.id,
      action: "profile_update",
      before: beforeDiff,
      after: afterDiff,
    });
  }

  return ok({
    data: {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      avatarUrl: updated.avatarUrl ?? null,
      location: updated.location
    }
  });
});
