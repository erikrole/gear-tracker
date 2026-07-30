import { z } from "zod";
import { Prisma } from "@prisma/client";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { enforceRateLimit, SETTINGS_MUTATION_LIMIT } from "@/lib/rate-limit";
import { apnsTokenSchema } from "@/lib/validation";

const MAX_ACTIVE_DEVICE_TOKENS_PER_USER = 8;

const registerSchema = z.object({
  token: z.string().min(1).max(512),
  platform: z.enum(["IOS", "ANDROID"]).default("IOS"),
  appVersion: z.string().max(64).optional(),
}).refine(
  (body) => body.platform !== "IOS" || apnsTokenSchema.safeParse(body.token).success,
  {
    path: ["token"],
    message: "iOS APNs token must be an even-length hexadecimal string",
  },
);

const revokeSchema = z.object({
  token: z.string().min(1).max(512),
}).strict();

export const POST = withAuth(async (req, { user }) => {
  await enforceRateLimit(`devices:register:${user.id}`, SETTINGS_MUTATION_LIMIT);
  const body = registerSchema.parse(await req.json());
  const now = new Date();

  await db.$transaction(async (tx) => {
    const activeUser = await tx.user.findUnique({
      where: { id: user.id },
      select: { active: true },
    });
    if (!activeUser?.active) {
      throw new HttpError(401, "Account deactivated");
    }

    await tx.deviceToken.upsert({
      where: { token: body.token },
      update: {
        userId: user.id,
        platform: body.platform,
        appVersion: body.appVersion,
        lastSeenAt: now,
        revokedAt: null,
      },
      create: {
        userId: user.id,
        token: body.token,
        platform: body.platform,
        appVersion: body.appVersion,
      },
    });

    // Keep normal multi-device use and token rotation, but bound active rows.
    // The read stays fixed-size; updateMany retires every older row at once.
    const kept = await tx.deviceToken.findMany({
      where: { userId: user.id, revokedAt: null },
      orderBy: [
        { lastSeenAt: "desc" },
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: MAX_ACTIVE_DEVICE_TOKENS_PER_USER,
      select: { id: true },
    });
    await tx.deviceToken.updateMany({
      where: {
        userId: user.id,
        revokedAt: null,
        id: { notIn: kept.map((row) => row.id) },
      },
      data: { revokedAt: now },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  return ok({ success: true });
});

export const DELETE = withAuth(async (req, { user }) => {
  const rawBody = await req.text();
  let token: string | undefined;
  if (rawBody.trim().length > 0) {
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      throw new HttpError(400, "Request body must be valid JSON");
    }
    token = revokeSchema.parse(parsedBody).token;
  }

  if (token) {
    await db.deviceToken.updateMany({
      where: { token, userId: user.id },
      data: { revokedAt: new Date() },
    });
  } else {
    await db.deviceToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  return ok({ success: true });
});
