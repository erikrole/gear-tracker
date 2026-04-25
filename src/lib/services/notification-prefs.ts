import { db } from "@/lib/db";

/**
 * Per-user notification preferences. Stored as JSON on User.notificationPrefs;
 * a null record means "receive everything" (matches the original behavior so
 * users created before this feature don't need a backfill).
 *
 * `pausedUntil` is the canonical "do not disturb" — when set in the future,
 * non-in-app channels skip. In-app delivery (notifications inbox row) always
 * fires regardless of prefs so the user can catch up later.
 */
export type NotificationPrefs = {
  pausedUntil: string | null;
  channels: { email: boolean; push: boolean };
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  pausedUntil: null,
  channels: { email: true, push: true },
};

/** Defensive parse — old shapes or partial writes fall back to defaults. */
export function normalizePrefs(raw: unknown): NotificationPrefs {
  if (!raw || typeof raw !== "object") return DEFAULT_NOTIFICATION_PREFS;
  const r = raw as Record<string, unknown>;
  const channels = (r.channels && typeof r.channels === "object" ? r.channels : {}) as Record<string, unknown>;
  return {
    pausedUntil: typeof r.pausedUntil === "string" ? r.pausedUntil : null,
    channels: {
      email: channels.email === false ? false : true,
      push: channels.push === false ? false : true,
    },
  };
}

export async function loadUserPrefs(userId: string): Promise<NotificationPrefs> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { notificationPrefs: true },
  });
  return normalizePrefs(user?.notificationPrefs);
}

export async function saveUserPrefs(userId: string, prefs: NotificationPrefs): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { notificationPrefs: prefs as unknown as object },
  });
}

function isPaused(prefs: NotificationPrefs, now = new Date()): boolean {
  if (!prefs.pausedUntil) return false;
  const until = new Date(prefs.pausedUntil);
  if (Number.isNaN(until.getTime())) return false;
  return until.getTime() > now.getTime();
}

export function shouldDeliverEmail(prefs: NotificationPrefs): boolean {
  if (isPaused(prefs)) return false;
  return prefs.channels.email;
}

export function shouldDeliverPush(prefs: NotificationPrefs): boolean {
  if (isPaused(prefs)) return false;
  return prefs.channels.push;
}
