"use client";

import { useMemo } from "react";
import BookingListPage, { type BookingListConfig, type BookingItem } from "@/components/BookingListPage";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

export default function CheckoutsPage() {
  const confirm = useConfirm();
  const { toast } = useToast();

  const config: BookingListConfig = useMemo(() => ({
    kind: "CHECKOUT",
    apiBase: "/api/checkouts",
    label: "checkout",
    labelPlural: "Checkouts",
    actionLabel: "Check out equipment",
    actionLabelProgress: "Checking out\u2026",
    requesterLabel: "Checked out to",
    startLabel: "Pickup",
    endLabel: "Return by",
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
          if (!c) return;
          const ok = await confirm({
            title: "Cancel checkout",
            message: `Cancel "${c.title}"?`,
            confirmLabel: "Cancel checkout",
            variant: "danger",
          });
          if (!ok) return;
          try {
            const res = await fetch(`/api/bookings/${bookingId}/cancel`, { method: "POST" });
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
