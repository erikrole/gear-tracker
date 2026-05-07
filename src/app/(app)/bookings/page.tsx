"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BookingListPage, { type BookingListConfig, type BookingItem, type ContextMenuExtra } from "@/components/BookingListPage";
import { useConfirm } from "@/components/ConfirmDialog";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LayoutGridIcon, ListIcon } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { handleAuthRedirect, parseErrorMessage } from "@/lib/errors";
import { FadeUp } from "@/components/ui/motion";
import { PageHeader } from "@/components/PageHeader";

/** Shared fetch wrapper with 401 redirect */
async function fetchAction(url: string, method = "POST"): Promise<Response> {
  const res = await fetch(url, { method });
  handleAuthRedirect(res, "/bookings");
  return res;
}

const ACTIVE_STATUS_OPTIONS = [
  { value: "OPEN", label: "Open" },
  { value: "DRAFT", label: "Draft" },
  { value: "BOOKED", label: "Booked" },
  { value: "PENDING_PICKUP", label: "Pending pickup" },
];

const PAST_STATUS_OPTIONS = [
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function BookingsPage() {
  const confirm = useConfirm();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (["all", "checkouts", "reservations"] as const).includes(searchParams.get("tab") as never)
    ? (searchParams.get("tab") as "all" | "checkouts" | "reservations")
    : "checkouts";
  const [activeTab, setActiveTab] = useState<"all" | "checkouts" | "reservations">(initialTab);
  const [scope, setScope] = useState<"active" | "past">(searchParams.get("past") === "true" ? "past" : "active");
  const [viewMode, setViewModeRaw] = useState<"cards" | "table">(() => {
    try { return localStorage.getItem("bookings-view-mode") === "table" ? "table" : "cards"; }
    catch { return "cards"; }
  });

  // Consume highlight once from URL so only the correct tab receives it (avoids all-tabs-mount race)
  const [highlight] = useState<string | null>(() => searchParams.get("highlight") || null);

  useEffect(() => {
    if (highlight) {
      const next = new URLSearchParams(searchParams.toString());
      next.delete("highlight");
      const qs = next.toString();
      router.replace(qs ? `/bookings?${qs}` : "/bookings", { scroll: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setViewMode(mode: "cards" | "table") {
    setViewModeRaw(mode);
    try { localStorage.setItem("bookings-view-mode", mode); } catch { /* ignore */ }
  }

  const handleTabChange = useCallback((value: string) => {
    const nextTab = value as "all" | "checkouts" | "reservations";
    setActiveTab(nextTab);
    const next = new URLSearchParams(searchParams.toString());
    next.set("tab", nextTab);
    next.delete("highlight");
    const qs = next.toString();
    router.replace(qs ? `/bookings?${qs}` : "/bookings", { scroll: false });
  }, [router, searchParams]);

  const handleScopeChange = useCallback((value: string) => {
    if (value !== "active" && value !== "past") return;
    setScope(value);
    const next = new URLSearchParams(searchParams.toString());
    if (value === "past") next.set("past", "true");
    else next.delete("past");
    next.delete("status");
    next.delete("filter");
    next.delete("highlight");
    const qs = next.toString();
    router.replace(qs ? `/bookings?${qs}` : "/bookings", { scroll: false });
  }, [router, searchParams]);

  const isPastScope = scope === "past";

  const checkoutContextMenuExtras = useMemo<ContextMenuExtra[]>(() => [
    {
      action: "checkin",
      label: "Check in",
      kind: "CHECKOUT",
      opensSheet: true,
    },
    {
      action: "cancel",
      label: "Cancel checkout",
      kind: "CHECKOUT",
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

        const prevItems = [...items];
        setItems?.((list) =>
          list.map((i) => (i.id === bookingId ? { ...i, status: "CANCELLED" } : i)),
        );

        try {
          const res = await fetchAction(`/api/bookings/${bookingId}/cancel`);
          if (!res.ok) {
            setItems?.(() => prevItems);
            const msg = await parseErrorMessage(res, "Cancel failed");
            toast.error(msg);
          } else {
            toast.success("Checkout cancelled");
          }
        } catch {
          setItems?.(() => prevItems);
          toast.error("Failed to cancel checkout. Please try again.");
        }
      },
    },
  ], [confirm]);

  const reservationContextMenuExtras = useMemo<ContextMenuExtra[]>(() => [
    {
      action: "convert",
      label: "Start checkout",
      kind: "RESERVATION",
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
            toast.success("Reservation converted to checkout");
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
      kind: "RESERVATION",
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
      kind: "RESERVATION",
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

        const prevItems = [...items];
        setItems?.((list) =>
          list.map((i) => (i.id === bookingId ? { ...i, status: "CANCELLED" } : i)),
        );

        try {
          const res = await fetchAction(`/api/reservations/${bookingId}/cancel`);
          if (!res.ok) {
            setItems?.(() => prevItems);
            const msg = await parseErrorMessage(res, "Cancel failed");
            toast.error(msg);
          } else {
            toast.success("Reservation cancelled");
          }
        } catch {
          setItems?.(() => prevItems);
          toast.error("Failed to cancel reservation. Please try again.");
        }
      },
    },
  ], [confirm, router]);

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
    statusOptions: isPastScope
      ? PAST_STATUS_OPTIONS
      : [
          { value: "OPEN", label: "Open" },
          { value: "PENDING_PICKUP", label: "Pending pickup" },
        ],
    defaultTieToEvent: true,
    hasSportFilter: true,
    overdueStatus: "OPEN",
    defaultStatusFilter: isPastScope ? "" : "OPEN",
    pastOnly: isPastScope,
    scopeLabel: isPastScope ? "Past" : undefined,
    showEventBadge: true,
    contextMenuExtras: checkoutContextMenuExtras,
  }), [checkoutContextMenuExtras, isPastScope]);

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
    statusOptions: isPastScope ? PAST_STATUS_OPTIONS : ACTIVE_STATUS_OPTIONS,
    defaultTieToEvent: false,
    hasSportFilter: true,
    activeOnly: !isPastScope,
    pastOnly: isPastScope,
    scopeLabel: isPastScope ? "Past" : "Active",
    overdueStatus: "",
    defaultStatusFilter: "",
    showEventBadge: true,
    contextMenuExtras: [...checkoutContextMenuExtras, ...reservationContextMenuExtras],
  }), [checkoutContextMenuExtras, reservationContextMenuExtras, isPastScope]);

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
    statusOptions: isPastScope
      ? PAST_STATUS_OPTIONS
      : [
          { value: "DRAFT", label: "Draft" },
          { value: "BOOKED", label: "Booked" },
        ],
    defaultTieToEvent: true,
    hasSportFilter: true,
    overdueStatus: "BOOKED",
    defaultStatusFilter: isPastScope ? "" : "BOOKED",
    pastOnly: isPastScope,
    scopeLabel: isPastScope ? "Past" : undefined,
    showEventBadge: true,
    contextMenuExtras: reservationContextMenuExtras,
  }), [reservationContextMenuExtras, isPastScope]);

  return (
    <FadeUp>
      <PageHeader title="Bookings" />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border">
          <TabsList className="min-w-0 flex-1 overflow-x-auto scrollbar-hide" aria-label="Booking type">
            <TabsTrigger
              value="all"
              className="relative shrink-0 gap-1.5 border-b-transparent data-[state=active]:border-b-transparent after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[var(--wi-red)] after:opacity-0 after:transition-opacity data-[state=active]:after:opacity-100"
            >
              <span style={{ fontFamily: "var(--font-heading)", fontWeight: 500 }}>All</span>
            </TabsTrigger>
            <TabsTrigger
              value="checkouts"
              className="relative shrink-0 gap-1.5 border-b-transparent data-[state=active]:border-b-transparent after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[var(--wi-red)] after:opacity-0 after:transition-opacity data-[state=active]:after:opacity-100"
            >
              <span style={{ fontFamily: "var(--font-heading)", fontWeight: 500 }}>Checkouts</span>
            </TabsTrigger>
            <TabsTrigger
              value="reservations"
              className="relative shrink-0 gap-1.5 border-b-transparent data-[state=active]:border-b-transparent after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[var(--wi-red)] after:opacity-0 after:transition-opacity data-[state=active]:after:opacity-100"
            >
              <span style={{ fontFamily: "var(--font-heading)", fontWeight: 500 }}>Reservations</span>
            </TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup
              type="single"
              value={scope}
              onValueChange={handleScopeChange}
              className="shrink-0 rounded-md border border-border/60 bg-background p-0.5"
              aria-label="Booking time scope"
            >
              <ToggleGroupItem value="active" className="h-8 px-3 text-xs" aria-label="Show active bookings">
                Active
              </ToggleGroupItem>
              <ToggleGroupItem value="past" className="h-8 px-3 text-xs" aria-label="Show past bookings">
                Past
              </ToggleGroupItem>
            </ToggleGroup>
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(value) => {
                if (value === "cards" || value === "table") setViewMode(value);
              }}
              className="shrink-0"
              aria-label="Booking view"
            >
              <ToggleGroupItem value="cards" className="size-8 p-0" aria-label="Card view">
                <LayoutGridIcon className="size-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="table" className="size-8 p-0" aria-label="List view">
                <ListIcon className="size-4" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        <TabsContent value="all">
          <BookingListPage key={`all-${scope}`} config={allConfig} viewMode={viewMode} hideHeader hideNewButton initialHighlight={initialTab === "all" ? highlight : null} />
        </TabsContent>

        <TabsContent value="checkouts">
          <BookingListPage key={`checkouts-${scope}`} config={checkoutConfig} viewMode={viewMode} hideHeader initialHighlight={initialTab === "checkouts" ? highlight : null} />
        </TabsContent>

        <TabsContent value="reservations">
          <BookingListPage key={`reservations-${scope}`} config={reservationConfig} viewMode={viewMode} hideHeader initialHighlight={initialTab === "reservations" ? highlight : null} />
        </TabsContent>
      </Tabs>
    </FadeUp>
  );
}
