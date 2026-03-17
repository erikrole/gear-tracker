import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok, HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { studentAreaSchema } from "@/lib/validation";
import { createAuditEntry } from "@/lib/audit";

export const GET = withAuth(async (req, { user }) => {
  requirePermission(user.role, "student_area", "view");

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");

  const where = userId
    ? user.role === "STUDENT" && user.id !== userId
      ? { userId: user.id }
      : { userId }
    : user.role === "STUDENT"
      ? { userId: user.id }
      : {};

  const assignments = await db.studentAreaAssignment.findMany({
    where,
    include: { user: { select: { id: true, name: true } } },
    orderBy: { area: "asc" },
  });

  return ok({ data: assignments });
});

export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "student_area", "manage");

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
    actorId: user.id,
    actorRole: user.role,
    entityType: "student_area_assignment",
    entityId: assignment.id,
    action: "area_assigned",
    after: { userId: body.userId, area: body.area, isPrimary: body.isPrimary },
  });

  return ok({ data: assignment }, 201);
});

export const DELETE = withAuth(async (req, { user }) => {
  requirePermission(user.role, "student_area", "manage");

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) throw new HttpError(400, "id query parameter required");

  await db.studentAreaAssignment.delete({ where: { id } });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "student_area_assignment",
    entityId: id,
    action: "area_removed",
  });

  return ok({ success: true });
});
