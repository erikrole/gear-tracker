import { z } from "zod";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok } from "@/lib/http";

const registerSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(["IOS", "ANDROID"]).default("IOS"),
  appVersion: z.string().optional(),
});

export const POST = withAuth(async (req, { user }) => {
  const body = registerSchema.parse(await req.json());

  await db.deviceToken.upsert({
    where: { token: body.token },
    update: {
      userId: user.id,
      platform: body.platform,
      appVersion: body.appVersion,
      lastSeenAt: new Date(),
      revokedAt: null,
    },
    create: {
      userId: user.id,
      token: body.token,
      platform: body.platform,
      appVersion: body.appVersion,
    },
  });

  return ok({ success: true });
});

export const DELETE = withAuth(async (req, { user }) => {
  const body = await req.json().catch(() => ({}));
  const token = (body as { token?: string }).token;

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
