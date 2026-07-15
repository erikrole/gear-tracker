import { z } from "zod";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { enforceRateLimit, SETTINGS_MUTATION_LIMIT } from "@/lib/rate-limit";
import { createAuditEntry } from "@/lib/audit";
import { normalizeWiscardNumber } from "@/lib/validation";
import { normalizeProfilePhone, nullableProfilePhoneSchema, phoneAuditValue } from "@/lib/profile-phone";

const putSchema = z.object({
  name: z.string().min(1, "Name is required").max(100).transform((s) => s.trim()),
  phone: nullableProfilePhoneSchema,
  personalPhone: nullableProfilePhoneSchema,
  workPhone: nullableProfilePhoneSchema,
  wiscardNumber: z.string().max(128).nullable().optional().transform((s) => normalizeWiscardNumber(s)),
  primaryArea: z.enum(["VIDEO", "PHOTO", "GRAPHICS", "COMMS"]).nullable(),
  title: z.string().max(100).nullable().transform((s) => s?.trim() || null),
  athleticsEmail: z
    .string()
    .email("Must be a valid email address")
    .max(200)
    .nullable()
    .transform((s) => s?.trim() || null),
  slackHandle: z.string().max(100).nullable().transform((s) => s?.trim() || null),
});

function auditProfileData(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [
    key,
    key === "phone" || key === "personalPhone" || key === "workPhone"
      ? phoneAuditValue(value)
      : value,
  ]));
}

/** GET /api/me/profile — returns the caller's editable profile fields. */
export const GET = withAuth(async (_req, { user }) => {
  const profile = await db.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      name: true,
      phone: true,
      personalPhone: true,
      workPhone: true,
      workPhoneNotApplicable: true,
      wiscardNumber: true,
      avatarUrl: true,
      primaryArea: true,
      title: true,
      athleticsEmail: true,
      slackHandle: true,
    },
  });

  if (!profile) throw new HttpError(404, "User not found");
  return ok({ data: profile });
});

/** PUT /api/me/profile — update editable identity fields (not email or role). */
export const PUT = withAuth(async (req, { user }) => {
  await enforceRateLimit(`profile:${user.id}`, SETTINGS_MUTATION_LIMIT);

  let body: z.infer<typeof putSchema>;
  try {
    body = putSchema.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw new HttpError(400, err.errors[0]?.message ?? "Invalid request body");
    }
    throw err;
  }

  const before = await db.user.findUnique({
    where: { id: user.id },
    select: {
      name: true,
      phone: true,
      personalPhone: true,
      workPhone: true,
      workPhoneNotApplicable: true,
      wiscardNumber: true,
      primaryArea: true,
      title: true,
      athleticsEmail: true,
      slackHandle: true,
    },
  });

  const data: Record<string, unknown> = { ...body };
  if (body.phone !== undefined) {
    const personalPhone = normalizeProfilePhone(body.phone);
    data.phone = personalPhone;
    data.personalPhone = personalPhone;
  }
  if (body.personalPhone !== undefined) {
    const personalPhone = normalizeProfilePhone(body.personalPhone);
    data.personalPhone = personalPhone;
    data.phone = personalPhone;
  }
  if (body.workPhone !== undefined) {
    const workPhone = normalizeProfilePhone(body.workPhone);
    data.workPhone = workPhone;
    data.workPhoneNotApplicable = workPhone === null;
  }

  let updated;
  try {
    updated = await db.user.update({
      where: { id: user.id },
      data,
      select: {
        id: true,
        name: true,
        phone: true,
        personalPhone: true,
        workPhone: true,
        workPhoneNotApplicable: true,
        wiscardNumber: true,
        avatarUrl: true,
        primaryArea: true,
        title: true,
        athleticsEmail: true,
        slackHandle: true,
      },
    });
  } catch (err: unknown) {
    const prismaErr = err as { code?: string; meta?: { target?: string[] } };
    if (prismaErr?.code === "P2002" && prismaErr.meta?.target?.includes("athletics_email")) {
      throw new HttpError(409, "That athletics email is already in use by another account.");
    }
    if (prismaErr?.code === "P2002" && prismaErr.meta?.target?.includes("wiscard_number")) {
      throw new HttpError(409, "That Wiscard value is already linked to another account.");
    }
    throw err;
  }

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "user",
    entityId: user.id,
    action: "profile_updated",
    before: before ? auditProfileData(before) : undefined,
    after: auditProfileData(data),
  });

  return ok({ data: updated });
});
