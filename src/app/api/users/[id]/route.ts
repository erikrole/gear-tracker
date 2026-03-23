import { withAuth } from "@/lib/api";
import { ShiftArea } from "@prisma/client";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { requireRole } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";
import { z } from "zod";

const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  locationId: z.string().cuid().nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  primaryArea: z.nativeEnum(ShiftArea).nullable().optional(),
});

export const GET = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requireRole(user.role, ["ADMIN", "STAFF", "STUDENT"]);
  const { id } = params;

  // Students can only view themselves
  if (user.role === "STUDENT" && user.id !== id) {
    throw new HttpError(403, "Forbidden");
  }

  const target = await db.user.findUnique({
    where: { id },
    include: {
      location: { select: { name: true } },
      sportAssignments: true,
      areaAssignments: true,
    },
  });
  if (!target) throw new HttpError(404, "User not found");

  return ok({
    data: {
      id: target.id,
      name: target.name,
      email: target.email,
      role: target.role,
      locationId: target.locationId,
      location: target.location?.name ?? null,
      phone: target.phone,
      primaryArea: target.primaryArea,
      avatarUrl: target.avatarUrl ?? null,
      createdAt: target.createdAt?.toISOString() ?? null,
      sportAssignments: target.sportAssignments,
      areaAssignments: target.areaAssignments,
    },
  });
});

export const PATCH = withAuth<{ id: string }>(async (req, { user, params }) => {
  requireRole(user.role, ["ADMIN", "STAFF"]);

  const { id } = params;
  const body = updateUserSchema.parse(await req.json());

  const target = await db.user.findUnique({ where: { id } });
  if (!target) {
    throw new HttpError(404, "User not found");
  }

  const updateData: Record<string, unknown> = {};

  if (body.name !== undefined) {
    updateData.name = body.name;
  }

  if (body.email !== undefined) {
    const email = body.email.toLowerCase();
    if (email !== target.email) {
      const existing = await db.user.findUnique({ where: { email } });
      if (existing) {
        throw new HttpError(409, "A user with this email already exists");
      }
      updateData.email = email;
    }
  }

  if (body.locationId !== undefined) {
    updateData.locationId = body.locationId;
  }

  if (body.phone !== undefined) {
    updateData.phone = body.phone;
  }

  if (body.primaryArea !== undefined) {
    updateData.primaryArea = body.primaryArea;
  }

  if (Object.keys(updateData).length === 0) {
    throw new HttpError(400, "No fields to update");
  }

  const beforeDiff: Record<string, unknown> = {};
  const afterDiff: Record<string, unknown> = {};
  for (const key of Object.keys(updateData)) {
    beforeDiff[key] = (target as Record<string, unknown>)[key] ?? null;
  }

  const updated = await db.user.update({
    where: { id },
    data: updateData,
    include: {
      location: { select: { name: true } },
      sportAssignments: true,
      areaAssignments: true,
    },
  });

  for (const key of Object.keys(updateData)) {
    afterDiff[key] = (updated as Record<string, unknown>)[key] ?? null;
  }

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "user",
    entityId: id,
    action: "updated",
    before: beforeDiff,
    after: afterDiff,
  });

  return ok({
    data: {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      locationId: updated.locationId,
      location: updated.location?.name ?? null,
      phone: updated.phone,
      primaryArea: updated.primaryArea,
      avatarUrl: updated.avatarUrl ?? null,
      createdAt: updated.createdAt?.toISOString() ?? null,
      sportAssignments: updated.sportAssignments,
      areaAssignments: updated.areaAssignments,
    },
  });
});
