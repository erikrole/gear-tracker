"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
const BookingDetailsSheet = dynamic(() => import("@/components/BookingDetailsSheet"), { ssr: false });
const CreateBookingSheet = dynamic(() => import("@/components/CreateBookingSheet"), { ssr: false });
import EmptyState from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Progress } from "@/components/ui/progress";
import { RefreshCwIcon } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useConfirm } from "@/components/ConfirmDialog";
import { toast } from "sonner";
import { formatRelativeTime } from "@/lib/format";
import { handleAuthRedirect, parseErrorMessage } from "@/lib/errors";
import { useFetch } from "@/hooks/use-fetch";

import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useDashboardFilters } from "@/hooks/use-dashboard-filters";
import { DashboardSkeleton } from "./dashboard/dashboard-skeleton";
import { FilterChips } from "./dashboard/filter-chips";
import { StatCard } from "./dashboard/stat-card";
import { OverdueBanner } from "./dashboard/overdue-banner";
import { FlaggedItemsBanner } from "./dashboard/flagged-items-banner";
import { LostBulkUnitsCard } from "./dashboard/lost-bulk-units-card";
import { MyGearColumn } from "./dashboard/my-gear-column";
import { TeamActivityColumn } from "./dashboard/team-activity-column";
import { PageTransition, StaggerList, StaggerItem } from "@/components/ui/motion";
import type { BookingSummary, CreateBookingContext } from "./dashboard-types";
import type { BookingListConfig } from "@/components/booking-list";
import { toLocalDateTimeValue } from "@/components/booking-list";

/* ── Minimal configs for the create sheet (only used for dashboard) ── */

const CHECKOUT_CONFIG: BookingListConfig = {
  kind: "CHECKOUT",
  apiBase: "/api/checkouts",
  label: "checkout",
  labelPlural: "Checkouts",
  actionLabel: "Pick up now",
  actionLabelProgress: "Picking up\u2026",
  requesterLabel: "Checked out to",
  startLabel: "Pickup",
  endLabel: "Return by",
  statusOptions: [],
  defaultTieToEvent: true,
  hasSportFilter: true,
  overdueStatus: "OPEN",
  showEventBadge: true,
  contextMenuExtras: [],
};

const RESERVATION_CONFIG: BookingListConfig = {
  kind: "RESERVATION",
  apiBase: "/api/reservations",
  label: "reservation",
  labelPlural: "Reservations",
  actionLabel: "Reserve for later",
  actionLabelProgress: "Reserving\u2026",
  requesterLabel: "Reserved for",
  startLabel: "Start",
  endLabel: "End",
  statusOptions: [],
  defaultTieToEvent: true,
  hasSportFilter: true,
  overdueStatus: "BOOKED",
  showEventBadge: true,
  contextMenuExtras: [],
};

export default function DashboardPage() {
  const { data, fetchError, refreshing, lastRefreshed, loadData, setData } = useDashboardData();
  const filters = useDashboardFilters(data);
  const [now, setNow] = useState(() => new Date());
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);
  const confirm = useConfirm();

  // ── Create booking sheet state ──
  const [createCtx, setCreateCtx] = useState<CreateBookingContext | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);

  // Lazy-fetch form options + current user (fires once createCtx is set)
  const shouldFetchFormData = !!createCtx;

  const { data: rawFormOptions } = useFetch<{ users: any[]; locations: any[]; bulkSkus: any[] }>({
    url: "/api/form-options",
    enabled: shouldFetchFormData,
    refetchOnFocus: false,
    transform: (json) => ({
      users: (json.data as any)?.users || [],
      locations: (json.data as any)?.locations || [],
      bulkSkus: (json.data as any)?.bulkSkus || [],
    }),
  });

  const { data: meData } = useFetch<{ id: string }>({
    url: "/api/me",
    enabled: shouldFetchFormData,
    refetchOnFocus: false,
    transform: (json) => (json as any)?.user ?? { id: "" },
  });

  const formOptions = rawFormOptions ?? null;
  const currentUserId = meData?.id ?? "";

  const handleCreateBooking = useCallback((ctx: CreateBookingContext) => {
    setCreateCtx(ctx);
  }, []);

  // Live countdown tick every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const handleDeleteDraft = async (draftId: string) => {
    const draft = data?.drafts.find((d) => d.id === draftId);
    if (!draft) return;
    const ok = await confirm({
      title: "Delete draft",
      message: `Delete this ${draft.kind === "CHECKOUT" ? "checkout" : "reservation"} draft? This can\u2019t be undone.`,
      confirmLabel: "Delete draft",
      variant: "danger",
    });
    if (!ok) return;
    // Optimistic: remove from list immediately
    setDeletingDraftId(draftId);
    const prevDrafts = data!.drafts;
    setData((prev) => prev ? { ...prev, drafts: prev.drafts.filter((x) => x.id !== draftId) } : prev);
    try {
      const res = await fetch(`/api/drafts/${draftId}`, { method: "DELETE" });
      if (handleAuthRedirect(res, "/")) return;
      if (res.ok) {
        toast.success("Draft deleted");
      } else {
        setData((prev) => prev ? { ...prev, drafts: prevDrafts } : prev);
        toast.error("Failed to delete draft");
      }
    } catch {
      setData((prev) => prev ? { ...prev, drafts: prevDrafts } : prev);
      toast.error("Network error \u2014 couldn\u2019t delete draft");
    } finally {
      setDeletingDraftId(null);
    }
  };

  /* ── Inline Actions ─────────────────────────────────── */

  const [inlineActionId, setInlineActionId] = useState<string | null>(null);

  const handleExtend = async (booking: BookingSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    if (inlineActionId) return;
    setInlineActionId(booking.id);
    try {
      const newEnd = new Date(new Date(booking.endsAt).getTime() + 24 * 60 * 60 * 1000);
      const endpoint = booking.kind === "RESERVATION"
        ? `/api/reservations/${booking.id}/extend`
        : `/api/bookings/${booking.id}/extend`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endsAt: newEnd.toISOString() }),
      });
      if (handleAuthRedirect(res, "/")) return;
      if (res.ok) {
        toast.success("Extended by 1 day");
        loadData(true);
      } else {
        const msg = await parseErrorMessage(res, "Extend failed");
        toast.error(msg);
      }
    } catch {
      toast.error("Network error — couldn\u2019t extend");
    } finally {
      setInlineActionId(null);
    }
  };

  const handleConvert = async (bookingId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (inlineActionId) return;
    setInlineActionId(bookingId);
    try {
      const res = await fetch(`/api/reservations/${bookingId}/convert`, { method: "POST" });
      if (handleAuthRedirect(res, "/")) return;
      if (res.ok) {
        toast.success("Converted to checkout");
        loadData(true);
      } else {
        const msg = await parseErrorMessage(res, "Convert failed");
        toast.error(msg);
      }
    } catch {
      toast.error("Network error — couldn\u2019t convert");
    } finally {
      setInlineActionId(null);
    }
  };

  if (fetchError) {
    return (
      <EmptyState
        icon={fetchError === "network" ? "bell" : "box"}
        title={fetchError === "network" ? "You\u2019re offline" : "Couldn\u2019t load your dashboard"}
        description={fetchError === "network"
          ? "Check your connection and try again."
          : "Something went wrong on our end. This is usually temporary."}
        actionLabel="Try again"
        onAction={() => loadData()}
      />
    );
  }

  if (!data) return <DashboardSkeleton />;

  const isStudent = data.role === "STUDENT";

  return (
    <PageTransition>
      {/* ══════ Page Header + Quick Actions ══════ */}
      <PageHeader title="Dashboard" className="mb-6 max-md:mb-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="text-muted-foreground"
            >
              <RefreshCwIcon className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{lastRefreshed ? `Updated ${formatRelativeTime(lastRefreshed.toISOString(), now)}` : "Refresh"}</TooltipContent>
        </Tooltip>
        <FilterChips {...filters} />
        {!isStudent && (
          <div className="flex gap-2">
            <Button onClick={() => handleCreateBooking({ kind: "CHECKOUT" })}>New checkout</Button>
            <Button onClick={() => handleCreateBooking({ kind: "RESERVATION" })}>New reservation</Button>
          </div>
        )}
      </PageHeader>

      {/* ══════ Stat Strip ══════ */}
      {refreshing && <Progress className="h-0.5 mb-1" />}
      {!isStudent && <StaggerList className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-4">
        <StaggerItem><StatCard href="/checkouts?filter=overdue" value={data.stats.overdue} label="Overdue" accent={data.stats.overdue > 0 ? "red" : undefined} /></StaggerItem>
        <StaggerItem><StatCard href="/bookings?tab=checkouts&filter=due-today" value={data.stats.dueToday} label="Due today" accent={data.stats.dueToday > 0 ? "amber" : undefined} /></StaggerItem>
        <StaggerItem><StatCard href="/bookings?tab=checkouts" value={data.stats.checkedOut} label="Active checkouts" /></StaggerItem>
        <StaggerItem><StatCard href="/bookings?tab=reservations" value={data.stats.reserved} label="Reserved" /></StaggerItem>
      </StaggerList>}

      {/* ══════ Welcome Banner (first-run) ══════ */}
      {data.stats.checkedOut === 0 && data.stats.overdue === 0 && data.stats.reserved === 0 && data.stats.dueToday === 0
        && data.myCheckouts.total === 0 && data.teamCheckouts.total === 0 && data.upcomingEvents.length === 0
        && data.myReservations.length === 0 && data.drafts.length === 0 && data.myShifts.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-6 mb-4 animate-[empty-fade-in_0.4s_ease-out] max-md:p-4">
          <h2 className="font-[var(--font-heading)] text-lg font-extrabold m-0 mb-1">Welcome to Gear Tracker</h2>
          <p className="text-sm text-muted-foreground m-0 mb-4">Get started by setting up your equipment inventory.</p>
          <div className="flex gap-3 max-md:flex-col">
            <Link href="/items" className="flex items-center gap-2.5 py-3 px-4 border border-border rounded-lg text-[13px] font-medium text-foreground no-underline flex-1 transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]">
              <span className="size-6 rounded-full bg-primary text-primary-foreground font-bold text-xs grid place-items-center shrink-0">1</span>
              <span>Add equipment</span>
            </Link>
            <Link href="/import" className="flex items-center gap-2.5 py-3 px-4 border border-border rounded-lg text-[13px] font-medium text-foreground no-underline flex-1 transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]">
              <span className="size-6 rounded-full bg-primary text-primary-foreground font-bold text-xs grid place-items-center shrink-0">2</span>
              <span>Import from spreadsheet</span>
            </Link>
            <Link href="/settings/calendar-sources" className="flex items-center gap-2.5 py-3 px-4 border border-border rounded-lg text-[13px] font-medium text-foreground no-underline flex-1 transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]">
              <span className="size-6 rounded-full bg-primary text-primary-foreground font-bold text-xs grid place-items-center shrink-0">3</span>
              <span>Set up calendar sync</span>
            </Link>
          </div>
        </div>
      )}

      {/* ══════ Overdue Banner ══════ */}
      <OverdueBanner
        overdueCount={data.overdueCount}
        overdueItems={data.overdueItems}
        now={now}
        onSelectBooking={setSelectedBookingId}
      />

      {/* ══════ Flagged Items Banner (staff/admin only) ══════ */}
      {!isStudent && data.flaggedItems.length > 0 && (
        <FlaggedItemsBanner items={data.flaggedItems} />
      )}

      {/* ══════ Lost Bulk Units (admin only) ══════ */}
      {data.role === "ADMIN" && data.lostBulkUnits.length > 0 && (
        <LostBulkUnitsCard items={data.lostBulkUnits} />
      )}

      {/* ══════ Two-Column Split ══════ */}
      <div className={isStudent ? "grid grid-cols-1 gap-6 max-w-[640px]" : "grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 items-start"}>
        <MyGearColumn
          data={data}
          filtered={filters.filtered}
          activeSport={filters.activeSport}
          now={now}
          deletingDraftId={deletingDraftId}
          inlineActionId={inlineActionId}
          ownedAccent
          onSelectBooking={setSelectedBookingId}
          onDeleteDraft={handleDeleteDraft}
          onExtend={handleExtend}
          onConvert={handleConvert}
          onCreateBooking={handleCreateBooking}
        />
        {!isStudent && (
          <TeamActivityColumn
            data={data}
            filtered={filters.filtered}
            activeSport={filters.activeSport}
            now={now}
            isStaff={data.role === "STAFF" || data.role === "ADMIN"}
            inlineActionId={inlineActionId}
            onSelectBooking={setSelectedBookingId}
            onExtend={handleExtend}
            onCreateBooking={handleCreateBooking}
          />
        )}
      </div>

      {/* ══════ Booking Detail Sheet ══════ */}
      <BookingDetailsSheet
        bookingId={selectedBookingId}
        onClose={() => setSelectedBookingId(null)}
        onUpdated={() => loadData(true)}
      />

      {/* ══════ Create Booking Sheet (in-place on dashboard) ══════ */}
      {createCtx && formOptions && (
        <CreateBookingSheet
          open
          onOpenChange={(open) => { if (!open) setCreateCtx(null); }}
          config={createCtx.kind === "CHECKOUT" ? CHECKOUT_CONFIG : RESERVATION_CONFIG}
          users={formOptions.users}
          locations={formOptions.locations}
          bulkSkus={formOptions.bulkSkus}
          onCreated={(bookingId) => {
            setCreateCtx(null);
            setSelectedBookingId(bookingId);
            loadData(true);
          }}
          draftId={draftId}
          onDraftIdChange={setDraftId}
          initialTitle={createCtx.title}
          initialStartsAt={createCtx.startsAt ? toLocalDateTimeValue(new Date(createCtx.startsAt)) : undefined}
          initialEndsAt={createCtx.endsAt ? toLocalDateTimeValue(new Date(createCtx.endsAt)) : undefined}
          initialLocationId={createCtx.locationId}
          initialRequester={currentUserId}
          initialEventId={createCtx.eventId}
          initialSportCode={createCtx.sportCode}
        />
      )}
    </PageTransition>
  );
}
