import type { BlastSeverity, Prisma, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { sendPush } from "@/lib/push/apns";
import { deferPush } from "@/lib/services/notifications";
import { normalizePrefs, shouldDeliverPush } from "@/lib/services/notification-prefs";
import { resolveBlastTargets, type BlastTargetSpec } from "@/lib/services/blast-targeting";

/**
 * Hard ceiling on one blast. The fan-out itself is batched and flat in N, but a
 * four-hundred-person broadcast is almost always a mis-selected filter rather than
 * an intent, and it is cheaper to make the sender narrow it than to recall it.
 */
export const MAX_BLAST_RECIPIENTS = 500;

export type CreateBlastInput = {
  title: string;
  body: string;
  severity: BlastSeverity;
  requiresAck: boolean;
  expiresAt: Date | null;
  spec: BlastTargetSpec;
};

export type CreateBlastResult = {
  id: string;
  recipientCount: number;
  targetSummary: string;
  sentAt: Date;
};

/**
 * Resolves the target, freezes the recipient set, writes inbox copies, and hands
 * the push off to a deferred batched send.
 *
 * The recipient set is frozen deliberately: the tracking page reports "21 of 34
 * acknowledged", and a denominator that shifts as the crew changes makes that
 * number meaningless. Drift is surfaced on the tracking page instead.
 */
export async function createAndSendBlast(
  input: CreateBlastInput,
  actor: { id: string; role: Role },
): Promise<CreateBlastResult> {
  const target = await resolveBlastTargets(input.spec);

  if (target.userIds.length === 0) {
    throw new HttpError(400, "That target matches nobody right now.");
  }
  if (target.userIds.length > MAX_BLAST_RECIPIENTS) {
    throw new HttpError(
      400,
      `That target reaches ${target.userIds.length} people, over the ${MAX_BLAST_RECIPIENTS} limit. Narrow it first.`,
    );
  }

  const sentAt = new Date();
  const blast = await db.$transaction(async (tx) => {
    const created = await tx.blast.create({
      data: {
        title: input.title,
        body: input.body,
        severity: input.severity,
        status: "SENDING",
        targetKind: input.spec.kind,
        targetSpec: input.spec as unknown as Prisma.InputJsonValue,
        targetSummary: target.summary,
        eventId: target.eventId,
        requiresAck: input.requiresAck,
        expiresAt: input.expiresAt,
        recipientCount: target.userIds.length,
        createdById: actor.id,
      },
      select: { id: true },
    });
    await tx.blastRecipient.createMany({
      data: target.userIds.map((userId) => ({ blastId: created.id, userId })),
      skipDuplicates: true,
    });
    return created;
  });

  await writeInboxCopies(blast.id, input, target.userIds);

  await db.blast.update({
    where: { id: blast.id },
    data: { status: "SENT", sentAt },
  });

  deferPush(sendBlastPush(blast.id));

  return {
    id: blast.id,
    recipientCount: target.userIds.length,
    targetSummary: target.summary,
    sentAt,
  };
}

/**
 * Archive copies in the existing inbox, so the web notifications page, the unread
 * badge, and the iOS notifications sheet pick blasts up without new wiring.
 * `BlastRecipient` remains the authoritative acknowledgment ledger.
 */
async function writeInboxCopies(
  blastId: string,
  input: Pick<CreateBlastInput, "title" | "body">,
  userIds: string[],
): Promise<void> {
  await Promise.allSettled(
    userIds.map(async (userId) => {
      // `Notification.dedupeKey` is globally unique, so the prefix is required to
      // avoid colliding with schedule and trade keys.
      const dedupeKey = `blast:${blastId}:${userId}`;
      try {
        const notification = await db.notification.create({
          data: {
            userId,
            type: "blast",
            title: input.title,
            body: input.body,
            payload: { blastId },
            channel: "IN_APP",
            sentAt: new Date(),
            dedupeKey,
          },
          select: { id: true },
        });
        await db.blastRecipient.update({
          where: { blastId_userId: { blastId, userId } },
          data: { notificationId: notification.id },
        });
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "P2002") return;
        throw error;
      }
    }),
  );
}

/**
 * Batched APNs send for a whole blast: ~4 queries and one dispatch regardless of
 * recipient count. Looping `sendPushToUser` would be two queries and one dispatch
 * per person, all held open by `after()`.
 *
 * Never throws -- this runs inside `deferPush`/`after()`, where an unhandled
 * rejection is fatal in modern Node.
 */
export async function sendBlastPush(blastId: string): Promise<void> {
  try {
    const blast = await db.blast.findUnique({
      where: { id: blastId },
      select: { title: true, body: true, status: true },
    });
    if (!blast || blast.status === "CANCELLED") return;

    const recipients = await db.blastRecipient.findMany({
      where: { blastId },
      select: { userId: true, user: { select: { notificationPrefs: true } } },
    });
    if (recipients.length === 0) return;

    const eligible: string[] = [];
    const skipped: string[] = [];
    for (const recipient of recipients) {
      const prefs = normalizePrefs(recipient.user.notificationPrefs);
      // The in-app banner always shows; only the push honors pause and channel prefs.
      (shouldDeliverPush(prefs) ? eligible : skipped).push(recipient.userId);
    }

    const attemptedAt = new Date();
    const tokens = eligible.length
      ? await db.deviceToken.findMany({
          where: { userId: { in: eligible }, revokedAt: null },
          select: { token: true, userId: true },
        })
      : [];

    let revoked: string[] = [];
    if (tokens.length > 0) {
      ({ revoked } = await sendPush(
        tokens.map((t) => t.token),
        { title: blast.title, body: blast.body, payload: { blastId } },
      ));
    }

    const revokedSet = new Set(revoked);
    const withAnyToken = new Set(tokens.map((t) => t.userId));
    const withLiveToken = new Set(
      tokens.filter((t) => !revokedSet.has(t.token)).map((t) => t.userId),
    );

    const sentIds = eligible.filter((id) => withLiveToken.has(id));
    // Had tokens, but every one of them came back revoked -- a stale token must not
    // read as delivered on the tracking page.
    const failedIds = eligible.filter((id) => withAnyToken.has(id) && !withLiveToken.has(id));
    const noDeviceIds = eligible.filter((id) => !withAnyToken.has(id));

    await Promise.all([
      updatePushStatus(blastId, skipped, "SKIPPED_PREFS", attemptedAt),
      updatePushStatus(blastId, noDeviceIds, "NO_DEVICE", attemptedAt),
      updatePushStatus(blastId, sentIds, "SENT", attemptedAt),
      updatePushStatus(blastId, failedIds, "FAILED", attemptedAt),
    ]);

    if (revoked.length > 0) {
      await db.deviceToken.updateMany({
        where: { token: { in: revoked } },
        data: { revokedAt: new Date() },
      });
    }
  } catch (err) {
    console.error(`[BLAST] push for ${blastId} failed:`, err);
  }
}

async function updatePushStatus(
  blastId: string,
  userIds: string[],
  pushStatus: "SENT" | "SKIPPED_PREFS" | "NO_DEVICE" | "FAILED",
  attemptedAt: Date,
): Promise<void> {
  if (userIds.length === 0) return;
  await db.blastRecipient.updateMany({
    where: { blastId, userId: { in: userIds } },
    data: { pushStatus, pushAttemptedAt: attemptedAt },
  });
}

/**
 * Idempotent: cancelling an already-cancelled blast is a no-op, not an error.
 * Cancelling stops the banner on the next fetch; already-delivered APNs alerts
 * cannot be recalled.
 */
export async function cancelBlast(blastId: string, actor: { id: string }): Promise<void> {
  const blast = await db.blast.findUnique({
    where: { id: blastId },
    select: { id: true, cancelledAt: true },
  });
  if (!blast) throw new HttpError(404, "Blast not found");
  if (blast.cancelledAt) return;

  await db.blast.update({
    where: { id: blastId },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelledById: actor.id },
  });
}

export type ActiveBlastForUser = {
  id: string;
  title: string;
  body: string;
  severity: BlastSeverity;
  sentAt: Date | null;
  senderName: string | null;
  requiresAck: boolean;
  readAt: Date | null;
};

/**
 * The unacknowledged blasts the iOS dashboard banner renders, most severe first.
 * Expiry and cancellation are filtered server-side so the client never has to be
 * trusted with the clock.
 */
export async function listActiveBlastsForUser(
  userId: string,
  now: Date = new Date(),
): Promise<ActiveBlastForUser[]> {
  const rows = await db.blastRecipient.findMany({
    where: {
      userId,
      acknowledgedAt: null,
      blast: {
        status: "SENT",
        cancelledAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    },
    select: {
      readAt: true,
      blast: {
        select: {
          id: true,
          title: true,
          body: true,
          severity: true,
          sentAt: true,
          requiresAck: true,
          createdBy: { select: { name: true } },
        },
      },
    },
    orderBy: [{ blast: { severity: "desc" } }, { blast: { sentAt: "desc" } }],
    take: 5,
  });

  return rows.map((row) => ({
    id: row.blast.id,
    title: row.blast.title,
    body: row.blast.body,
    severity: row.blast.severity,
    sentAt: row.blast.sentAt,
    senderName: row.blast.createdBy?.name ?? null,
    requiresAck: row.blast.requiresAck,
    readAt: row.readAt,
  }));
}
