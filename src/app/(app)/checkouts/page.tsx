"use client";

import BookingListPage, { type BookingListConfig, type BookingItem } from "@/components/BookingListPage";

const config: BookingListConfig = {
  kind: "CHECKOUT",
  apiBase: "/api/checkouts",
  label: "check-out",
  labelPlural: "Check-outs",
  statusBadge: {
    DRAFT: "badge-gray",
    OPEN: "badge-green",
    COMPLETED: "badge-purple",
    CANCELLED: "badge-red",
  },
  statusOptions: [
    { value: "OPEN", label: "Open" },
    { value: "COMPLETED", label: "Completed" },
    { value: "CANCELLED", label: "Cancelled" },
  ],
  defaultTieToEvent: true,
  hasSportFilter: true,
  overdueStatus: "OPEN",
  showEventBadge: true,
  contextMenuExtras: [
    {
      action: "checkin",
      label: "Check in",
      opensSheet: true,
    },
    {
      action: "cancel",
      label: "Cancel checkout",
      danger: true,
      handler: async (bookingId, items, reload) => {
        const c = items.find((i: BookingItem) => i.id === bookingId);
        if (!c || !confirm(`Cancel "${c.title}"?`)) return;
        try {
          await fetch(`/api/bookings/${bookingId}/cancel`, { method: "POST" });
          await reload();
        } catch { /* network */ }
      },
    },
  ],
};

export default function CheckoutsPage() {
  return <BookingListPage config={config} />;
}
