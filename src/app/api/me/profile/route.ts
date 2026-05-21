import { z } from "zod";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { enforceRateLimit, SETTINGS_MUTATION_LIMIT } from "@/lib/rate-limit";
import { createAuditEntry } from "@/lib/audit";

const putSchema = z.object({
  name: z.string().min(1, "Name is required").max(100).transform((s) => s.trim()),
  phone: z.string().max(30).nullable().transform((s) => s?.trim() || null),
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

/** GET /api/me/profile — returns the caller's editable profile fields. */
export const GET = withAuth(async (_req, { user }) => {
  const profile = await db.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      name: true,
      phone: true,
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
      primaryArea: true,
      title: true,
      athleticsEmail: true,
      slackHandle: true,
    },
  });

  let updated;
  try {
    updated = await db.user.update({
      where: { id: user.id },
      data: body,
      select: {
        id: true,
        name: true,
        phone: true,
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
    throw err;
  }

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "user",
    entityId: user.id,
    action: "profile_updated",
    before: before ?? undefined,
    after: body as unknown as Record<string, unknown>,
  });

  return ok({ data: updated });
});
