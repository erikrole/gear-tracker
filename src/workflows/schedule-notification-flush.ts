import { sleep } from "workflow";
import { flushScheduleNotifications } from "@/lib/services/schedule-notification-flush";

/**
 * Wait out the quiet period, then tell whoever the change actually affects.
 *
 * There is no version to match on here. The old release workflow had to prove it
 * was the newest run before touching anything, because it applied a staged
 * payload. This one only reads live state and compares it against what workers
 * were last told, so an extra run is harmless: it either finds the work already
 * done or does it.
 */
export async function scheduleNotificationFlushWorkflow(
  shiftGroupId: string,
  notifyAfterIso: string,
) {
  "use workflow";

  const notifyAfter = new Date(notifyAfterIso);
  if (notifyAfter.getTime() > Date.now()) await sleep(notifyAfter);
  return runScheduleNotificationFlush(shiftGroupId);
}

export async function runScheduleNotificationFlush(shiftGroupId: string) {
  "use step";

  return flushScheduleNotifications(shiftGroupId);
}
