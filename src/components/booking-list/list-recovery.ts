import type { BookingItem, ListResponse } from "./types";

export function applyBookingItemsUpdate(
  prev: ListResponse | undefined,
  updater: BookingItem[] | ((items: BookingItem[]) => BookingItem[]),
): ListResponse | undefined {
  if (!prev) return prev;
  const previousItems = prev.data ?? [];
  const nextItems = typeof updater === "function" ? updater(previousItems) : updater;
  const removedVisibleRows = Math.max(0, previousItems.length - nextItems.length);

  return {
    ...prev,
    data: nextItems,
    total: removedVisibleRows > 0 ? Math.max(0, prev.total - removedVisibleRows) : prev.total,
  };
}
