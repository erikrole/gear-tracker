import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { requireRole } from "@/lib/rbac";
import { enforceRateLimit, SETTINGS_MUTATION_LIMIT } from "@/lib/rate-limit";
import { createAuditEntry } from "@/lib/audit";
import { z } from "zod";

const createBlockSchema = z.object({
  kind:             z.enum(["WEEKLY", "AD_HOC"]).default("WEEKLY"),
  intent:           z.enum(["CANNOT_WORK", "PREFER", "DISLIKE", "TIME_OFF"]).default("CANNOT_WORK"),
  status:           z.enum(["APPROVED", "PENDING", "DENIED"]).optional(),
  dayOfWeek:        z.number().int().min(0).max(6).optional().nullable(),
  date:             z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional().nullable(),
  startsAt:         z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:mm"),
  endsAt:           z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:mm"),
  label:            z.string().trim().max(80).optional(),
  semesterLabel:    z.string().trim().max(40).optional(),
  semesterStartsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional().nullable(),
  semesterEndsOn:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional().nullable(),
  reviewNote:       z.string().trim().max(500).optional().nullable(),
});

function parseDateOnly(value: string | null | undefined): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function assertBlockShape(body: z.infer<typeof createBlockSchema>) {
  if (body.startsAt >= body.endsAt) {
    throw new HttpError(400, "Start time must be before end time");
  }
  if (body.kind === "WEEKLY") {
    if (body.dayOfWeek === null || body.dayOfWeek === undefined) {
      throw new HttpError(400, "Day of week is required for weekly availability");
    }
    if (body.date) {
      throw new HttpError(400, "Weekly availability cannot include an ad hoc date");
    }
  }
  if (body.kind === "AD_HOC") {
    if (!body.date) {
      throw new HttpError(400, "Date is required for ad hoc availability");
    }
    if (body.dayOfWeek !== null && body.dayOfWeek !== undefined) {
      throw new HttpError(400, "Ad hoc availability cannot include a day of week");
    }
  }
  if (body.semesterStartsOn && body.semesterEndsOn && body.semesterStartsOn > body.semesterEndsOn) {
    throw new HttpError(400, "Semester end date must be on or after start date");
  }
  if (body.intent !== "TIME_OFF" && body.status && body.status !== "APPROVED") {
    throw new HttpError(400, "Only time-off requests can be pending or denied");
  }
}

async function assertTargetStudent(id: string) {
  const target = await db.user.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!target) throw new HttpError(404, "User not found");
  if (target.role !== "STUDENT") throw new HttpError(400, "Availability is only available for students");
}

export const GET = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requireRole(user.role, ["ADMIN", "STAFF", "STUDENT"]);
  const { id } = params;

  if (user.role === "STUDENT" && user.id !== id) {
    throw new HttpError(403, "Forbidden");
  }

  const blocks = await db.studentAvailabilityBlock.findMany({
    where: { userId: id },
    orderBy: [{ kind: "asc" }, { dayOfWeek: "asc" }, { date: "asc" }, { startsAt: "asc" }],
  });

  return ok({ data: blocks });
});

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  requireRole(user.role, ["ADMIN", "STAFF", "STUDENT"]);
  const { id } = params;

  if (user.role === "STUDENT" && user.id !== id) {
    throw new HttpError(403, "Forbidden");
  }
  await enforceRateLimit(`availability:${user.id}`, SETTINGS_MUTATION_LIMIT);

  await assertTargetStudent(id);

  const body = createBlockSchema.parse(await req.json());
  assertBlockShape(body);
  const staffReview = user.role === "ADMIN" || user.role === "STAFF";
  const status = body.intent === "TIME_OFF"
    ? body.status ?? (staffReview ? "APPROVED" : "PENDING")
    : "APPROVED";

  const block = await db.studentAvailabilityBlock.create({
    data: {
      userId:           id,
      kind:             body.kind,
      intent:           body.intent,
      status,
      dayOfWeek:        body.kind === "WEEKLY" ? body.dayOfWeek : null,
      date:             body.kind === "AD_HOC" ? parseDateOnly(body.date) : null,
      startsAt:         body.startsAt,
      endsAt:           body.endsAt,
      label:            body.label ?? null,
      semesterLabel:    body.semesterLabel ?? null,
      semesterStartsOn: parseDateOnly(body.semesterStartsOn),
      semesterEndsOn:   parseDateOnly(body.semesterEndsOn),
      reviewedAt:       body.intent === "TIME_OFF" && staffReview && status !== "PENDING" ? new Date() : null,
      reviewedById:     body.intent === "TIME_OFF" && staffReview && status !== "PENDING" ? user.id : null,
      reviewNote:       body.reviewNote?.trim() || null,
    },
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "student_availability_block",
    entityId: block.id,
    action: "student_availability_created",
    after: {
      userId: id,
      kind: block.kind,
      intent: block.intent,
      status: block.status,
      dayOfWeek: block.dayOfWeek,
      date: block.date,
      startsAt: block.startsAt,
      endsAt: block.endsAt,
      label: block.label,
      semesterLabel: block.semesterLabel,
      semesterStartsOn: block.semesterStartsOn,
      semesterEndsOn: block.semesterEndsOn,
      reviewedAt: block.reviewedAt,
      reviewedById: block.reviewedById,
      reviewNote: block.reviewNote,
    },
  });

  return ok({ data: block }, 201);
});
