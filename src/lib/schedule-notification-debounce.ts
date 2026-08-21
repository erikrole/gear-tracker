import { start } from "workflow/api";
import { db } from "@/lib/db";
import { scheduleNotificationFlushWorkflow } from "@/workflows/schedule-notification-flush";

/**
 * How long a worker-visible edit stays quiet before the flush tells anyone.
 *
 * This is a notification debounce, not an embargo: the assignment itself is
 * already committed and already visible. The window exists so that building a
 * crew sends one message instead of one per click, and so that assigning
 * someone and undoing it sends nothing at all.
 */
export const SCHEDULE_NOTIFY_DELAY_MS = 10 * 60_000;

/**
 * Push the flush out to the end of a fresh quiet period.
 *
 * Safe to call on every edit. Unlike the retired working-copy release, a
 * superseded run is harmless rather than something to guard against: the flush
 * diffs live state when it wakes, so an early run either finds the work already
 * done or does it, and the timestamp check keeps the last writer in charge.
 */
export async function scheduleNotificationFlush(args: {
  shiftGroupId: string;
  now?: Date;
  delayMs?: number;
}): Promise<{ at: Date }> {
  const at = new Date((args.now ?? new Date()).getTime() + (args.delayMs ?? SCHEDULE_NOTIFY_DELAY_MS));

  await db.shiftGroup.update({
    where: { id: args.shiftGroupId },
    data: { notifyAfter: at, notifyError: null },
  });

  try {
    await start(scheduleNotificationFlushWorkflow, [args.shiftGroupId, at.toISOString()]);
  } catch (error) {
    // The edit stands and `notifyAfter` is recorded, so a sweeper can still
    // deliver this. Losing the timer must not cost the operator their change.
    console.error("[Schedule] failed to start notification flush", {
      shiftGroupId: args.shiftGroupId,
      error,
    });
  }

  return { at };
}
