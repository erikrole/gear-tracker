import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { withAuth } from "@/lib/api";
import { createAuditEntryTx } from "@/lib/audit";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { tokenHash } from "@/lib/auth";
import { env } from "@/lib/env";
import { enforceRateLimit } from "@/lib/rate-limit";

/** GET /api/me/sessions — list all non-expired sessions for the caller. */
export const GET = withAuth(async (_req, { user }) => {
  await enforceRateLimit(`sessions:read:${user.id}`, { max: 30, windowMs: 60_000 });

  const cookieStore = await cookies();
  const raw = cookieStore.get(env.sessionCookieName)?.value;
  const currentHash = raw ? await tokenHash(raw) : null;

  const sessions = await db.session.findMany({
    where: { userId: user.id, expiresAt: { gt: new Date() } },
    select: { id: true, createdAt: true, expiresAt: true },
    orderBy: { createdAt: "desc" },
  });

  // Determine current session id without exposing tokenHash to the client
  let currentSessionId: string | null = null;
  if (currentHash) {
    const current = await db.session.findUnique({
      where: { tokenHash: currentHash },
      select: { id: true },
    });
    currentSessionId = current?.id ?? null;
  }

  return ok({
    data: sessions.map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      isCurrent: s.id === currentSessionId,
    })),
  });
});

/** DELETE /api/me/sessions — revoke all sessions except the current one. */
export const DELETE = withAuth(async (_req, { user }) => {
  await enforceRateLimit(`sessions:revoke:${user.id}`, { max: 10, windowMs: 60_000 });

  const cookieStore = await cookies();
  const raw = cookieStore.get(env.sessionCookieName)?.value;
  const currentHash = raw ? await tokenHash(raw) : null;

  if (!currentHash) {
    throw new HttpError(401, "Current session could not be verified. Sign in again.");
  }

  const revokedCount = await db.$transaction(async (tx) => {
    const current = await tx.session.findUnique({
      where: { tokenHash: currentHash },
      select: { id: true, userId: true },
    });
    if (!current || current.userId !== user.id) {
      throw new HttpError(401, "Current session could not be verified. Sign in again.");
    }

    const result = await tx.session.deleteMany({
      where: {
        userId: user.id,
        id: { not: current.id },
      },
    });

    if (result.count > 0) {
      await createAuditEntryTx(tx, {
        actorId: user.id,
        actorRole: user.role,
        entityType: "session",
        entityId: user.id,
        action: "session_revoked",
        after: {
          scope: "all_other",
          revokedSessionCount: result.count,
          preservedSessionId: current.id,
        },
      });
    }

    return result.count;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  return ok({ revokedCount });
});
