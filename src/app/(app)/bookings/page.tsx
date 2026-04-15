"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BookingListPage, { type BookingListConfig, type BookingItem } from "@/components/BookingListPage";
import { useConfirm } from "@/components/ConfirmDialog";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ClipboardCheckIcon, CalendarPlusIcon, LayersIcon, LayoutGridIcon, ListIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { handleAuthRedirect, parseErrorMessage } from "@/lib/errors";
import { FadeUp } from "@/components/ui/motion";
import { PageHeader } from "@/components/PageHeader";

/** Shared fetch wrapper with 401 redirect */
async function fetchAction(url: string, method = "POST"): Promise<Response> {
  const res = await fetch(url, { method });
  handleAuthRedirect(res, "/bookings");
  return res;
}

export default function BookingsPage() {
  const confirm = useConfirm();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (["all", "checkouts", "reservations"] as const).includes(searchParams.get("tab") as never)
    ? (searchParams.get("tab") as "all" | "checkouts" | "reservations")
    : "checkouts";
  const [activeTab, setActiveTab] = useState<"all" | "checkouts" | "reservations">(initialTab);
  const [viewMode, setViewModeRaw] = useState<"cards" | "table">("cards");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("bookings-view-mode");
      if (saved === "table") setViewModeRaw("table");
    } catch { /* ignore */ }
  }, []);

  function setViewMode(mode: "cards" | "table") {
    setViewModeRaw(mode);
    try { localStorage.setItem("bookings-view-mode", mode); } catch { /* ignore */ }
  }

  const checkoutConfig: BookingListConfig = useMemo(() => ({
    kind: "CHECKOUT",
    apiBase: "/api/checkouts",
    label: "checkout",
    labelPlural: "Checkouts",
    actionLabel: "Pick up now",
    actionLabelProgress: "Picking up\u2026",
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
        handler: async (bookingId, items, reload, setItems) => {
          const c = items.find((i: BookingItem) => i.id === bookingId);
          if (!c) return;
          const ok = await confirm({
            title: "Cancel checkout",
            message: `This will return all equipment to available inventory and unblock other bookings.`,
            confirmLabel: "Cancel checkout",
            variant: "danger",
          });
          if (!ok) return;

          // Optimistic update: mark as CANCELLED in local state
          const prevItems = [...items];
          setItems?.((list) =>
            list.map((i) => (i.id === bookingId ? { ...i, status: "CANCELLED" } : i)),
          );

          try {
            const res = await fetchAction(`/api/bookings/${bookingId}/cancel`);
            if (!res.ok) {
              // Rollback on server error
              setItems?.(() => prevItems);
              const msg = await parseErrorMessage(res, "Cancel failed");
              toast.error(msg);
            } else {
              toast.success("Checkout cancelled");
            }
          } catch {
            // Rollback on network error
            setItems?.(() => prevItems);
            toast.error("Failed to cancel checkout. Please try again.");
          }
        },
      },
    ],
  }), [confirm, toast]);

  const allConfig: BookingListConfig = useMemo(() => ({
    kind: "ALL",
    apiBase: "/api/bookings",
    label: "booking",
    labelPlural: "All Bookings",
    actionLabel: "",
    actionLabelProgress: "",
    requesterLabel: "Requested by",
    startLabel: "Start",
    endLabel: "End",
    statusOptions: [
      { value: "OPEN", label: "Open" },
      { value: "DRAFT", label: "Draft" },
      { value: "BOOKED", label: "Booked" },
      { value: "COMPLETED", label: "Completed" },
      { value: "CANCELLED", label: "Cancelled" },
    ],
    defaultTieToEvent: false,
    hasSportFilter: true,
    overdueStatus: "",
    defaultStatusFilter: "",
    showEventBadge: true,
    contextMenuExtras: [],
  }), []);

  const reservationConfig: BookingListConfig = useMemo(() => ({
    kind: "RESERVATION",
    apiBase: "/api/reservations",
    label: "reservation",
    labelPlural: "Reservations",
    actionLabel: "Reserve for later",
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
    defaultStatusFilter: "BOOKED",
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
              setActiveTab("checkouts"); router.push("/bookings?tab=checkouts");
            } else {
              const msg = await parseErrorMessage(res, "Conversion failed");
              toast.error(msg);
              await reload();
            }
          } catch {
            toast.error("Network error \u2014 please try again.");
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
              toast.success("Reservation duplicated");
              setActiveTab("reservations"); router.push("/bookings?tab=reservations");
            } else {
              const msg = await parseErrorMessage(res, "Duplicate failed");
              toast.error(msg);
            }
          } catch {
            toast.error("Network error \u2014 please try again.");
          }
        },
      },
      {
        action: "cancel",
        label: "Cancel reservation",
        danger: true,
        handler: async (bookingId, items, reload, setItems) => {
          const r = items.find((i: BookingItem) => i.id === bookingId);
          if (!r) return;
          const ok = await confirm({
            title: "Cancel reservation",
            message: `Cancel "${r.title}"? All held equipment will be released back to inventory.`,
            confirmLabel: "Cancel reservation",
            variant: "danger",
          });
          if (!ok) return;

          // Optimistic update: mark as CANCELLED in local state
          const prevItems = [...items];
          setItems?.((list) =>
            list.map((i) => (i.id === bookingId ? { ...i, status: "CANCELLED" } : i)),
          );

          try {
            const res = await fetchAction(`/api/reservations/${bookingId}/cancel`);
            if (!res.ok) {
              // Rollback on server error
              setItems?.(() => prevItems);
              const msg = await parseErrorMessage(res, "Cancel failed");
              toast.error(msg);
            } else {
              toast.success("Reservation cancelled");
            }
          } catch {
            // Rollback on network error
            setItems?.(() => prevItems);
            toast.error("Failed to cancel reservation. Please try again.");
          }
        },
      },
    ],
  }), [confirm, toast]);

  return (
    <FadeUp>
      <PageHeader title="Bookings" />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <div className="flex items-center border-b border-border">
          <TabsList className="border-b-0 flex-1 px-4 max-md:px-2" aria-label="Booking type">
            <TabsTrigger value="all" className="flex items-center gap-1.5 data-[state=active]:border-[var(--wi-red)]">
              <LayersIcon className="size-4" />
              <span style={{ fontFamily: "var(--font-heading)", fontWeight: 500 }}>All</span>
            </TabsTrigger>
            <TabsTrigger value="checkouts" className="flex items-center gap-1.5 data-[state=active]:border-[var(--wi-red)]">
              <ClipboardCheckIcon className="size-4" />
              <span style={{ fontFamily: "var(--font-heading)", fontWeight: 500 }}>Checkouts</span>
            </TabsTrigger>
            <TabsTrigger value="reservations" className="flex items-center gap-1.5 data-[state=active]:border-[var(--wi-red)]">
              <CalendarPlusIcon className="size-4" />
              <span style={{ fontFamily: "var(--font-heading)", fontWeight: 500 }}>Reservations</span>
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-0.5 px-3 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className={viewMode === "cards" ? "text-foreground bg-accent" : "text-muted-foreground"}
              onClick={() => setViewMode("cards")}
              aria-label="Card view"
            >
              <LayoutGridIcon className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={viewMode === "table" ? "text-foreground bg-accent" : "text-muted-foreground"}
              onClick={() => setViewMode("table")}
              aria-label="List view"
            >
              <ListIcon className="size-4" />
            </Button>
          </div>
        </div>

        <TabsContent value="all">
          <BookingListPage config={allConfig} viewMode={viewMode} hideHeader hideNewButton />
        </TabsContent>

        <TabsContent value="checkouts">
          <BookingListPage config={checkoutConfig} viewMode={viewMode} hideHeader />
        </TabsContent>

        <TabsContent value="reservations">
          <BookingListPage config={reservationConfig} viewMode={viewMode} hideHeader />
        </TabsContent>
      </Tabs>
    </FadeUp>
  );
}
