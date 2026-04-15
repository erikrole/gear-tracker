import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { requireRole } from "@/lib/rbac";
import { z } from "zod";

const createBlockSchema = z.object({
  dayOfWeek:     z.number().int().min(0).max(6),
  startsAt:      z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:mm"),
  endsAt:        z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:mm"),
  label:         z.string().trim().max(80).optional(),
  semesterLabel: z.string().trim().max(40).optional(),
});

export const GET = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requireRole(user.role, ["ADMIN", "STAFF", "STUDENT"]);
  const { id } = params;

  if (user.role === "STUDENT" && user.id !== id) {
    throw new HttpError(403, "Forbidden");
  }

  const blocks = await db.studentAvailabilityBlock.findMany({
    where: { userId: id },
    orderBy: [{ dayOfWeek: "asc" }, { startsAt: "asc" }],
  });

  return ok({ data: blocks });
});

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  requireRole(user.role, ["ADMIN", "STAFF", "STUDENT"]);
  const { id } = params;

  if (user.role === "STUDENT" && user.id !== id) {
    throw new HttpError(403, "Forbidden");
  }

  // Confirm target user exists
  const target = await db.user.findUnique({ where: { id }, select: { id: true } });
  if (!target) throw new HttpError(404, "User not found");

  const body = createBlockSchema.parse(await req.json());

  if (body.startsAt >= body.endsAt) {
    throw new HttpError(400, "Start time must be before end time");
  }

  const block = await db.studentAvailabilityBlock.create({
    data: {
      userId:        id,
      dayOfWeek:     body.dayOfWeek,
      startsAt:      body.startsAt,
      endsAt:        body.endsAt,
      label:         body.label ?? null,
      semesterLabel: body.semesterLabel ?? null,
    },
  });

  return ok({ data: block }, 201);
});
