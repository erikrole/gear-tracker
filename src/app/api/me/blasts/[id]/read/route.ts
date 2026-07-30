import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok, HttpError } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

/**
 * "The banner rendered on my screen." Idempotent -- an offline client replays this,
 * and the `readAt: null` guard means a replay never overwrites the original stamp.
 *
 * No audit entry: `BlastRecipient` is the ledger, and per-recipient rows would flood
 * a 90-day-retained audit log for no added accountability.
 */
export const POST = withAuth<{ id: string }>(async (_req, { user, params }) => {
  await enforceRateLimit(`me:blast-ack:${user.id}`, { max: 60, windowMs: 60_000 });

  const updated = await db.blastRecipient.updateMany({
    where: { blastId: params.id, userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });

  if (updated.count === 0) {
    // Either already read (fine) or not a recipient (404). Only a genuinely missing
    // row is an error.
    const exists = await db.blastRecipient.findUnique({
      where: { blastId_userId: { blastId: params.id, userId: user.id } },
      select: { id: true },
    });
    if (!exists) throw new HttpError(404, "Blast not found");
  }

  return ok({ success: true });
});
