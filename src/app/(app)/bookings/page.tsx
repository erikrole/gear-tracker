"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import BookingListPage, { type BookingListConfig, type BookingItem } from "@/components/BookingListPage";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ClipboardCheckIcon, CalendarPlusIcon } from "lucide-react";

/** Shared fetch wrapper with 401 redirect */
async function fetchAction(url: string, method = "POST"): Promise<Response> {
  const res = await fetch(url, { method });
  if (res.status === 401) {
    window.location.href = "/login";
  }
  return res;
}

export default function BookingsPage() {
  const confirm = useConfirm();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "reservations" ? "reservations" : "checkouts";
  const [activeTab, setActiveTab] = useState(initialTab);

  const checkoutConfig: BookingListConfig = useMemo(() => ({
    kind: "CHECKOUT",
    apiBase: "/api/checkouts",
    label: "checkout",
    labelPlural: "Checkouts",
    actionLabel: "Check out equipment",
    actionLabelProgress: "Checking out\u2026",
    requesterLabel: "Checked out to",
    startLabel: "Pickup",
    endLabel: "Return by",
    statusOptions: [
      { value: "OPEN", label: "Open" },
      { value: "COMPLETED", label: "Completed" },
      { value: "CANCELLED", label: "Cancelled" },
    ],
    defaultTieToEvent: true,
    hasSportFilter: true,
    overdueStatus: "OPEN",
    defaultStatusFilter: "OPEN",
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
            message: `Cancel "${c.title}"? This action cannot be undone.`,
            confirmLabel: "Cancel checkout",
            variant: "danger",
          });
          if (!ok) return;
          try {
            const res = await fetchAction(`/api/bookings/${bookingId}/cancel`);
            if (!res.ok) {
              const json = await res.json().catch(() => ({}));
              toast((json as Record<string, string>).error || "Cancel failed", "error");
            } else {
              toast("Checkout cancelled", "success");
            }
            await reload();
          } catch {
            toast("Network error \u2014 please try again.", "error");
          }
        },
      },
    ],
  }), [confirm, toast]);

  const reservationConfig: BookingListConfig = useMemo(() => ({
    kind: "RESERVATION",
    apiBase: "/api/reservations",
    label: "reservation",
    labelPlural: "Reservations",
    actionLabel: "Reserve equipment",
    actionLabelProgress: "Reserving\u2026",
    requesterLabel: "Reserved for",
    startLabel: "Start",
    endLabel: "End",
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
            const res = await fetchAction(`/api/reservations/${bookingId}/convert`);
            if (res.ok) {
              window.location.href = `/bookings?tab=checkouts`;
            } else {
              const json = await res.json().catch(() => ({}));
              toast((json as Record<string, string>).error || "Conversion failed", "error");
              await reload();
            }
          } catch {
            toast("Network error \u2014 please try again.", "error");
          }
        },
      },
      {
        action: "duplicate",
        label: "Duplicate",
        handler: async (bookingId) => {
          try {
            const res = await fetchAction(`/api/reservations/${bookingId}/duplicate`);
            if (res.ok) {
              toast("Reservation duplicated", "success");
              window.location.href = `/bookings?tab=reservations`;
            } else {
              const json = await res.json().catch(() => ({}));
              toast((json as Record<string, string>).error || "Duplicate failed", "error");
            }
          } catch {
            toast("Network error \u2014 please try again.", "error");
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
            message: `Cancel "${r.title}"? This action cannot be undone.`,
            confirmLabel: "Cancel reservation",
            variant: "danger",
          });
          if (!ok) return;
          try {
            const res = await fetchAction(`/api/reservations/${bookingId}/cancel`);
            if (!res.ok) {
              const json = await res.json().catch(() => ({}));
              toast((json as Record<string, string>).error || "Cancel failed", "error");
            } else {
              toast("Reservation cancelled", "success");
            }
            await reload();
          } catch {
            toast("Network error \u2014 please try again.", "error");
          }
        },
      },
    ],
  }), [confirm, toast]);

  return (
    <div>
      <div className="page-header">
        <h1>Bookings</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="px-4">
          <TabsTrigger value="checkouts" className="flex items-center gap-1.5">
            <ClipboardCheckIcon className="size-4" />
            Checkouts
          </TabsTrigger>
          <TabsTrigger value="reservations" className="flex items-center gap-1.5">
            <CalendarPlusIcon className="size-4" />
            Reservations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="checkouts">
          <BookingListPage config={checkoutConfig} viewMode="cards" hideHeader />
        </TabsContent>

        <TabsContent value="reservations">
          <BookingListPage config={reservationConfig} viewMode="cards" hideHeader />
        </TabsContent>
      </Tabs>
    </div>
  );
}
