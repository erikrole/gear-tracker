import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { withAuth } from "@/lib/api";
import { createAuditEntryTx } from "@/lib/audit";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { tokenHash } from "@/lib/auth";
import { env } from "@/lib/env";
import { enforceRateLimit } from "@/lib/rate-limit";

/** DELETE /api/me/sessions/[id] — revoke a specific session (cannot revoke the current one). */
export const DELETE = withAuth<{ id: string }>(async (_req, { user, params }) => {
  await enforceRateLimit(`sessions:revoke:${user.id}`, { max: 10, windowMs: 60_000 });

  const { id } = params;

  // Prevent revoking the session being used right now
  const cookieStore = await cookies();
  const raw = cookieStore.get(env.sessionCookieName)?.value;
  const currentHash = raw ? await tokenHash(raw) : null;

  if (!currentHash) {
    throw new HttpError(401, "Current session could not be verified. Sign in again.");
  }

  await db.$transaction(async (tx) => {
    const current = await tx.session.findUnique({
      where: { tokenHash: currentHash },
      select: { id: true, userId: true },
    });
    if (!current || current.userId !== user.id) {
      throw new HttpError(401, "Current session could not be verified. Sign in again.");
    }
    if (current.id === id) {
      throw new HttpError(400, "Cannot revoke your current session. Sign out instead.");
    }

    const target = await tx.session.findUnique({
      where: { id },
      select: { id: true, userId: true, createdAt: true, expiresAt: true },
    });
    if (!target || target.userId !== user.id) {
      throw new HttpError(404, "Session not found.");
    }

    const deleted = await tx.session.deleteMany({
      where: { id, userId: user.id },
    });
    if (deleted.count === 0) {
      throw new HttpError(404, "Session not found.");
    }

    await createAuditEntryTx(tx, {
      actorId: user.id,
      actorRole: user.role,
      entityType: "session",
      entityId: id,
      action: "session_revoked",
      before: {
        createdAt: target.createdAt.toISOString(),
        expiresAt: target.expiresAt.toISOString(),
        active: true,
      },
      after: {
        scope: "single",
        revoked: true,
        revokedSessionId: id,
        preservedSessionId: current.id,
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  return ok({ success: true });
});
