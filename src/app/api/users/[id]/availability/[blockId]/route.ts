import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { requireRole } from "@/lib/rbac";
import { enforceRateLimit, SETTINGS_MUTATION_LIMIT } from "@/lib/rate-limit";
import { createAuditEntry } from "@/lib/audit";
import { z } from "zod";

const updateBlockSchema = z.object({
  kind:             z.enum(["WEEKLY", "AD_HOC"]).default("WEEKLY"),
  dayOfWeek:        z.number().int().min(0).max(6).optional().nullable(),
  date:             z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional().nullable(),
  startsAt:         z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:mm"),
  endsAt:           z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:mm"),
  label:            z.string().trim().max(80).optional().nullable(),
  semesterLabel:    z.string().trim().max(40).optional().nullable(),
  semesterStartsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional().nullable(),
  semesterEndsOn:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional().nullable(),
});

function parseDateOnly(value: string | null | undefined): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function assertBlockShape(body: z.infer<typeof updateBlockSchema>) {
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
}

async function findOwnedBlock(id: string, blockId: string) {
  const block = await db.studentAvailabilityBlock.findUnique({
    where: { id: blockId },
  });

  if (!block) throw new HttpError(404, "Block not found");
  if (block.userId !== id) throw new HttpError(404, "Block not found");
  return block;
}

function auditShape(block: Awaited<ReturnType<typeof findOwnedBlock>>) {
  return {
    userId: block.userId,
    kind: block.kind,
    dayOfWeek: block.dayOfWeek,
    date: block.date,
    startsAt: block.startsAt,
    endsAt: block.endsAt,
    label: block.label,
    semesterLabel: block.semesterLabel,
    semesterStartsOn: block.semesterStartsOn,
    semesterEndsOn: block.semesterEndsOn,
  };
}

export const PATCH = withAuth<{ id: string; blockId: string }>(async (req, { user, params }) => {
  requireRole(user.role, ["ADMIN", "STAFF", "STUDENT"]);
  const { id, blockId } = params;

  if (user.role === "STUDENT" && user.id !== id) {
    throw new HttpError(403, "Forbidden");
  }
  await enforceRateLimit(`availability:${user.id}`, SETTINGS_MUTATION_LIMIT);

  const existing = await findOwnedBlock(id, blockId);
  const body = updateBlockSchema.parse(await req.json());
  assertBlockShape(body);

  const block = await db.studentAvailabilityBlock.update({
    where: { id: blockId },
    data: {
      kind:             body.kind,
      dayOfWeek:        body.kind === "WEEKLY" ? body.dayOfWeek : null,
      date:             body.kind === "AD_HOC" ? parseDateOnly(body.date) : null,
      startsAt:         body.startsAt,
      endsAt:           body.endsAt,
      label:            body.label?.trim() || null,
      semesterLabel:    body.semesterLabel?.trim() || null,
      semesterStartsOn: parseDateOnly(body.semesterStartsOn),
      semesterEndsOn:   parseDateOnly(body.semesterEndsOn),
    },
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "student_availability_block",
    entityId: blockId,
    action: "student_availability_updated",
    before: auditShape(existing),
    after: auditShape(block),
  });

  return ok({ data: block });
});

export const DELETE = withAuth<{ id: string; blockId: string }>(async (_req, { user, params }) => {
  requireRole(user.role, ["ADMIN", "STAFF", "STUDENT"]);
  const { id, blockId } = params;

  if (user.role === "STUDENT" && user.id !== id) {
    throw new HttpError(403, "Forbidden");
  }
  await enforceRateLimit(`availability:${user.id}`, SETTINGS_MUTATION_LIMIT);

  const block = await findOwnedBlock(id, blockId);

  await db.studentAvailabilityBlock.delete({ where: { id: blockId } });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "student_availability_block",
    entityId: blockId,
    action: "student_availability_deleted",
    before: auditShape(block),
  });

  return ok({ data: null });
});
