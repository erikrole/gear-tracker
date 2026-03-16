export const runtime = "edge";

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, fail, HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { studentAreaSchema } from "@/lib/validation";
import { createAuditEntry } from "@/lib/audit";

export async function GET(req: Request) {
  try {
    const actor = await requireAuth();
    requirePermission(actor.role, "student_area", "view");

    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");

    const where = userId
      ? actor.role === "STUDENT" && actor.id !== userId
        ? { userId: actor.id }
        : { userId }
      : actor.role === "STUDENT"
        ? { userId: actor.id }
        : {};

    const assignments = await db.studentAreaAssignment.findMany({
      where,
      include: { user: { select: { id: true, name: true } } },
      orderBy: { area: "asc" },
    });

    return ok({ data: assignments });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requireAuth();
    requirePermission(actor.role, "student_area", "manage");

    const body = studentAreaSchema.parse(await req.json());

    // If setting as primary, unset any existing primary for this user
    if (body.isPrimary) {
      await db.studentAreaAssignment.updateMany({
        where: { userId: body.userId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const assignment = await db.studentAreaAssignment.upsert({
      where: {
        userId_area: { userId: body.userId, area: body.area },
      },
      create: {
        userId: body.userId,
        area: body.area,
        isPrimary: body.isPrimary,
      },
      update: {
        isPrimary: body.isPrimary,
      },
    });

    await createAuditEntry({
      actorId: actor.id,
      actorRole: actor.role,
      entityType: "student_area_assignment",
      entityId: assignment.id,
      action: "area_assigned",
      after: { userId: body.userId, area: body.area, isPrimary: body.isPrimary },
    });

    return ok({ data: assignment }, 201);
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(req: Request) {
  try {
    const actor = await requireAuth();
    requirePermission(actor.role, "student_area", "manage");

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) throw new HttpError(400, "id query parameter required");

    await db.studentAreaAssignment.delete({ where: { id } });

    await createAuditEntry({
      actorId: actor.id,
      actorRole: actor.role,
      entityType: "student_area_assignment",
      entityId: id,
      action: "area_removed",
    });

    return ok({ success: true });
  } catch (error) {
    return fail(error);
  }
}
