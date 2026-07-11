export const NOTIFICATION_COUNT_CHANGED_EVENT = "gear-tracker:notification-count-changed";

export function dispatchNotificationCountChanged(unreadCount: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NOTIFICATION_COUNT_CHANGED_EVENT, {
    detail: { unreadCount: Math.max(0, unreadCount) },
  }));
}
