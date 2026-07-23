import { z } from "zod";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { withAuth } from "@/lib/api";
import { createAuditEntryTx } from "@/lib/audit";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { hashPassword, verifyPassword, tokenHash } from "@/lib/auth";
import { env } from "@/lib/env";
import { enforceRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
  newPassword: z.string().min(8, "New password must be at least 8 characters."),
  revokeOtherSessions: z.boolean().default(false),
});

/** POST /api/me/change-password — verify current password and set a new one. */
export const POST = withAuth(async (req, { user }) => {
  // Tighter rate limit — protect against brute-force via this endpoint
  await enforceRateLimit(`change-password:${user.id}`, { max: 5, windowMs: 60_000 });

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw new HttpError(400, err.errors[0]?.message ?? "Invalid request.");
    }
    throw err;
  }

  const userRecord = await db.user.findUnique({
    where: { id: user.id },
    select: { id: true, passwordHash: true, forcePasswordChange: true },
  });
  if (!userRecord?.passwordHash) throw new HttpError(400, "Cannot change password for this account.");

  const valid = await verifyPassword(userRecord.passwordHash, body.currentPassword);
  if (!valid) throw new HttpError(400, "Current password is incorrect.");

  if (body.newPassword === body.currentPassword) {
    throw new HttpError(400, "New password must be different from the current password.");
  }

  let currentSessionHash: string | null = null;
  if (body.revokeOtherSessions) {
    const cookieStore = await cookies();
    const raw = cookieStore.get(env.sessionCookieName)?.value;
    currentSessionHash = raw ? await tokenHash(raw) : null;
    if (!currentSessionHash) {
      throw new HttpError(401, "Current session could not be verified. Sign in again.");
    }
  }

  const newHash = await hashPassword(body.newPassword);

  await db.$transaction(async (tx) => {
    const currentUser = await tx.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true, forcePasswordChange: true },
    });
    if (!currentUser || currentUser.passwordHash !== userRecord.passwordHash) {
      throw new HttpError(409, "Password changed while this request was in progress. Try again.");
    }

    let currentSessionId: string | null = null;
    if (body.revokeOtherSessions) {
      const currentSession = currentSessionHash
        ? await tx.session.findUnique({
            where: { tokenHash: currentSessionHash },
            select: { id: true, userId: true },
          })
        : null;
      if (!currentSession || currentSession.userId !== user.id) {
        throw new HttpError(401, "Current session could not be verified. Sign in again.");
      }
      currentSessionId = currentSession.id;
    }

    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash, forcePasswordChange: false },
    });

    const revoked = currentSessionId
      ? await tx.session.deleteMany({
          where: {
            userId: user.id,
            id: { not: currentSessionId },
          },
        })
      : { count: 0 };

    await createAuditEntryTx(tx, {
      actorId: user.id,
      actorRole: user.role,
      entityType: "user",
      entityId: user.id,
      action: "password_change",
      before: { forcePasswordChange: currentUser.forcePasswordChange },
      after: {
        forcePasswordChange: false,
        revokedOtherSessions: body.revokeOtherSessions,
        revokedSessionCount: revoked.count,
      },
    });

    if (revoked.count > 0) {
      await createAuditEntryTx(tx, {
        actorId: user.id,
        actorRole: user.role,
        entityType: "session",
        entityId: user.id,
        action: "session_revoked",
        after: {
          scope: "all_other",
          reason: "password_change",
          revokedSessionCount: revoked.count,
          preservedSessionId: currentSessionId,
        },
      });
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  return ok({ success: true });
});
