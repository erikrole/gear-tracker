"use client";

import BookingListPage, { type BookingListConfig, type BookingItem } from "@/components/BookingListPage";

const config: BookingListConfig = {
  kind: "RESERVATION",
  apiBase: "/api/reservations",
  label: "reservation",
  labelPlural: "Reservations",
  statusBadge: {
    DRAFT: "badge-gray",
    BOOKED: "badge-blue",
    OPEN: "badge-green",
    COMPLETED: "badge-purple",
    CANCELLED: "badge-red",
  },
  statusOptions: [
    { value: "DRAFT", label: "Draft" },
    { value: "BOOKED", label: "Booked" },
    { value: "COMPLETED", label: "Completed" },
    { value: "CANCELLED", label: "Cancelled" },
  ],
  defaultTieToEvent: false,
  hasSportFilter: false,
  overdueStatus: "BOOKED",
  showEventBadge: false,
  contextMenuExtras: [
    {
      action: "convert",
      label: "Start checkout",
      handler: async (bookingId, items, reload) => {
        const r = items.find((i: BookingItem) => i.id === bookingId);
        if (!r || !confirm(`Convert "${r.title}" to a checkout? The reservation will be cancelled.`)) return;
        try {
          const res = await fetch(`/api/reservations/${bookingId}/convert`, { method: "POST" });
          if (res.ok) {
            const json = await res.json();
            window.location.href = `/checkouts/${json.data.id}`;
          } else {
            const json = await res.json().catch(() => ({}));
            alert((json as Record<string, string>).error || "Conversion failed");
            await reload();
          }
        } catch {
          alert("Network error \u2014 please try again.");
        }
      },
    },
    {
      action: "cancel",
      label: "Cancel reservation",
      danger: true,
      handler: async (bookingId, items, reload) => {
        const r = items.find((i: BookingItem) => i.id === bookingId);
        if (!r || !confirm(`Cancel "${r.title}"?`)) return;
        try {
          const res = await fetch(`/api/reservations/${bookingId}/cancel`, { method: "POST" });
          if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            alert((json as Record<string, string>).error || "Cancel failed");
          }
          await reload();
        } catch {
          alert("Network error \u2014 please try again.");
        }
      },
    },
  ],
};

export default function ReservationsPage() {
  return <BookingListPage config={config} />;
}
