import { requireAuth } from "@/lib/auth";
import { ShiftArea } from "@prisma/client";
import { db } from "@/lib/db";
import { fail, HttpError, ok } from "@/lib/http";
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

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth();
    requireRole(actor.role, ["ADMIN", "STAFF", "STUDENT"]);
    const { id } = await ctx.params;

    // Students can only view themselves
    if (actor.role === "STUDENT" && actor.id !== id) {
      throw new HttpError(403, "Forbidden");
    }

    const user = await db.user.findUnique({
      where: { id },
      include: {
        location: { select: { name: true } },
        sportAssignments: true,
        areaAssignments: true,
      },
    });
    if (!user) throw new HttpError(404, "User not found");

    return ok({
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        locationId: user.locationId,
        location: user.location?.name ?? null,
        phone: user.phone,
        primaryArea: user.primaryArea,
        sportAssignments: user.sportAssignments,
        areaAssignments: user.areaAssignments,
      },
    });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAuth();
    requireRole(actor.role, ["ADMIN", "STAFF"]);

    const { id } = await ctx.params;
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

    const user = await db.user.update({
      where: { id },
      data: updateData,
      include: {
        location: { select: { name: true } },
        sportAssignments: true,
        areaAssignments: true,
      },
    });

    for (const key of Object.keys(updateData)) {
      afterDiff[key] = (user as Record<string, unknown>)[key] ?? null;
    }

    await createAuditEntry({
      actorId: actor.id,
      actorRole: actor.role,
      entityType: "user",
      entityId: id,
      action: "updated",
      before: beforeDiff,
      after: afterDiff,
    });

    return ok({
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        locationId: user.locationId,
        location: user.location?.name ?? null,
        phone: user.phone,
        primaryArea: user.primaryArea,
        sportAssignments: user.sportAssignments,
        areaAssignments: user.areaAssignments,
      },
    });
  } catch (error) {
    return fail(error);
  }
}
