import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok } from "@/lib/http";
import { sendPush } from "@/lib/push/apns";

/**
 * Sends a real test push to the caller's active devices and reports the
 * outcome, so "are my notifications working?" is answerable from the phone
 * in one tap instead of by reading serverless logs.
 */
export const POST = withAuth(async (_req, { user }) => {
  const tokens = await db.deviceToken.findMany({
    where: { userId: user.id, revokedAt: null },
    select: { token: true },
  });

  if (tokens.length === 0) {
    return ok({ delivered: 0, devices: 0, revoked: 0 });
  }

  const { revoked, ok: delivered } = await sendPush(
    tokens.map((t) => t.token),
    {
      title: "Test notification",
      body: "Push delivery is working on this device.",
    }
  );

  if (revoked.length > 0) {
    await db.deviceToken.updateMany({
      where: { token: { in: revoked } },
      data: { revokedAt: new Date() },
    });
  }

  return ok({ delivered, devices: tokens.length, revoked: revoked.length });
});
