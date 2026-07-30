import { z } from "zod";
import { Prisma } from "@prisma/client";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { enforceRateLimit, SETTINGS_MUTATION_LIMIT } from "@/lib/rate-limit";
import { revokeCheckoutReturnLiveActivityStartTokens } from "@/lib/services/live-activities";
import { apnsTokenSchema } from "@/lib/validation";

const registerSchema = z.object({
  token: apnsTokenSchema,
});

const CHECKOUT_RETURN_ACTIVITY = "checkout_return";
const MAX_ACTIVE_START_TOKENS_PER_USER = 8;

export const POST = withAuth(async (req, { user }) => {
  await enforceRateLimit(
    `live-activities:checkout-return:start-token:${user.id}`,
    SETTINGS_MUTATION_LIMIT,
  );
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

    await tx.liveActivityStartToken.upsert({
      where: { token: body.token },
      update: {
        userId: user.id,
        activity: CHECKOUT_RETURN_ACTIVITY,
        lastSeenAt: now,
        revokedAt: null,
      },
      create: {
        userId: user.id,
        token: body.token,
        activity: CHECKOUT_RETURN_ACTIVITY,
      },
    });

    // Push-to-start tokens rotate per installation. Keep several current
    // devices, then revoke every older active credential without loading an
    // unbounded history into the function.
    const kept = await tx.liveActivityStartToken.findMany({
      where: {
        userId: user.id,
        activity: CHECKOUT_RETURN_ACTIVITY,
        revokedAt: null,
      },
      orderBy: [
        { lastSeenAt: "desc" },
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: MAX_ACTIVE_START_TOKENS_PER_USER,
      select: { id: true },
    });
    await tx.liveActivityStartToken.updateMany({
      where: {
        userId: user.id,
        activity: CHECKOUT_RETURN_ACTIVITY,
        revokedAt: null,
        id: { notIn: kept.map((row) => row.id) },
      },
      data: { revokedAt: now },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  return ok({ success: true });
});

export const DELETE = withAuth(async (_req, { user }) => {
  await revokeCheckoutReturnLiveActivityStartTokens(user.id);

  return ok({ success: true });
});
