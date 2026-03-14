"use client";

import { useMemo } from "react";
import BookingListPage, { type BookingListConfig, type BookingItem } from "@/components/BookingListPage";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

export default function ReservationsPage() {
  const confirm = useConfirm();
  const { toast } = useToast();

  const config: BookingListConfig = useMemo(() => ({
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
    defaultTieToEvent: true,
    hasSportFilter: true,
    overdueStatus: "BOOKED",
    showEventBadge: true,
    contextMenuExtras: [
      {
        action: "convert",
        label: "Start checkout",
        handler: async (bookingId, items, reload) => {
          const r = items.find((i: BookingItem) => i.id === bookingId);
          if (!r) return;
          const ok = await confirm({
            title: "Convert to checkout",
            message: `Convert "${r.title}" to a checkout? The reservation will be cancelled.`,
            confirmLabel: "Start checkout",
          });
          if (!ok) return;
          try {
            const res = await fetch(`/api/reservations/${bookingId}/convert`, { method: "POST" });
            if (res.ok) {
              const json = await res.json();
              window.location.href = `/checkouts/${json.data.id}`;
            } else {
              const json = await res.json().catch(() => ({}));
              toast((json as Record<string, string>).error || "Conversion failed", "error");
              await reload();
            }
          } catch {
            toast("Network error — please try again.", "error");
          }
        },
      },
      {
        action: "duplicate",
        label: "Duplicate",
        handler: async (bookingId) => {
          try {
            const res = await fetch(`/api/reservations/${bookingId}/duplicate`, { method: "POST" });
            if (res.ok) {
              const json = await res.json();
              window.location.href = `/reservations/${json.data.id}`;
            } else {
              const json = await res.json().catch(() => ({}));
              toast((json as Record<string, string>).error || "Duplicate failed", "error");
            }
          } catch {
            toast("Network error — please try again.", "error");
          }
        },
      },
      {
        action: "cancel",
        label: "Cancel reservation",
        danger: true,
        handler: async (bookingId, items, reload) => {
          const r = items.find((i: BookingItem) => i.id === bookingId);
          if (!r) return;
          const ok = await confirm({
            title: "Cancel reservation",
            message: `Cancel "${r.title}"?`,
            confirmLabel: "Cancel reservation",
            variant: "danger",
          });
          if (!ok) return;
          try {
            const res = await fetch(`/api/reservations/${bookingId}/cancel`, { method: "POST" });
            if (!res.ok) {
              const json = await res.json().catch(() => ({}));
              toast((json as Record<string, string>).error || "Cancel failed", "error");
            }
            await reload();
          } catch {
            toast("Network error — please try again.", "error");
          }
        },
      },
    ],
  }), [confirm, toast]);

  return <BookingListPage config={config} />;
}
