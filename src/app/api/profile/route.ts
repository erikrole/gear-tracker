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
    select: {
      name: true, phone: true, locationId: true,
      title: true, athleticsEmail: true, startDate: true,
      gradYear: true, studentYearOverride: true,
      topSize: true, bottomSize: true, shoeSize: true,
    },
  });

  const data: Record<string, unknown> = {};
  if (payload.name !== undefined) data.name = payload.name;
  if (Object.prototype.hasOwnProperty.call(payload, "phone")) data.phone = payload.phone ?? null;
  if (Object.prototype.hasOwnProperty.call(payload, "locationId")) data.locationId = payload.locationId ?? null;
  if (Object.prototype.hasOwnProperty.call(payload, "title")) data.title = payload.title ?? null;
  if (Object.prototype.hasOwnProperty.call(payload, "athleticsEmail")) {
    data.athleticsEmail = payload.athleticsEmail ? payload.athleticsEmail.toLowerCase() : null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "startDate")) {
    data.startDate = payload.startDate ? new Date(payload.startDate) : null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "gradYear")) data.gradYear = payload.gradYear ?? null;
  if (Object.prototype.hasOwnProperty.call(payload, "studentYearOverride")) data.studentYearOverride = payload.studentYearOverride ?? null;
  if (Object.prototype.hasOwnProperty.call(payload, "topSize")) data.topSize = payload.topSize ?? null;
  if (Object.prototype.hasOwnProperty.call(payload, "bottomSize")) data.bottomSize = payload.bottomSize ?? null;
  if (Object.prototype.hasOwnProperty.call(payload, "shoeSize")) data.shoeSize = payload.shoeSize ?? null;

  let updated;
  try {
    updated = await db.user.update({
      where: { id: user.id },
      data,
      include: { location: { select: { id: true, name: true } } },
    });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "P2002") {
      throw new HttpError(409, "That athletics email is already in use");
    }
    throw err;
  }

  const beforeDiff: Record<string, unknown> = {};
  const afterDiff: Record<string, unknown> = {};
  for (const key of Object.keys(data)) {
    const before = (current as Record<string, unknown>)[key] ?? null;
    const after = (updated as Record<string, unknown>)[key] ?? null;
    const beforeKey = before instanceof Date ? before.toISOString() : before;
    const afterKey = after instanceof Date ? after.toISOString() : after;
    if (beforeKey !== afterKey) {
      beforeDiff[key] = beforeKey;
      afterDiff[key] = afterKey;
    }
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
