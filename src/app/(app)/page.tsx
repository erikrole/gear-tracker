"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
const BookingDetailsSheet = dynamic(() => import("@/components/BookingDetailsSheet"), { ssr: false });
import EmptyState from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Progress } from "@/components/ui/progress";
import { RefreshCwIcon } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useConfirm } from "@/components/ConfirmDialog";
import { toast } from "sonner";
import { formatRelativeTime } from "@/lib/format";
import { handleAuthRedirect, parseErrorMessage } from "@/lib/errors";
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

export default function DashboardPage() {
  const { data, fetchError, refreshing, lastRefreshed, loadData, setData } = useDashboardData();
  const filters = useDashboardFilters(data);
  const [now, setNow] = useState(() => new Date());
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);
  const confirm = useConfirm();

  // ── Navigate to booking wizard ──
  const router = useRouter();

  const handleCreateBooking = useCallback((ctx: CreateBookingContext) => {
    const base = ctx.kind === "CHECKOUT" ? "/checkouts/new" : "/reservations/new";
    const params = new URLSearchParams();
    if (ctx.title) params.set("title", ctx.title);
    if (ctx.startsAt) params.set("startsAt", ctx.startsAt);
    if (ctx.endsAt) params.set("endsAt", ctx.endsAt);
    if (ctx.locationId) params.set("locationId", ctx.locationId);
    if (ctx.eventId) params.set("eventId", ctx.eventId);
    if (ctx.sportCode) params.set("sportCode", ctx.sportCode);
    const qs = params.toString();
    router.push(qs ? `${base}?${qs}` : base);
  }, [router]);

  // Live countdown tick every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Ref guard prevents double-fire when two rapid clicks read stale state
  const actionBusyRef = useRef(false);

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
    if (actionBusyRef.current) return;
    actionBusyRef.current = true;
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
      actionBusyRef.current = false;
      setDeletingDraftId(null);
    }
  };

  /* ── Inline Actions ─────────────────────────────────── */

  const [inlineActionId, setInlineActionId] = useState<string | null>(null);

  const handleExtend = async (booking: BookingSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    if (actionBusyRef.current) return;
    actionBusyRef.current = true;
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
        loadData();
      } else {
        const msg = await parseErrorMessage(res, "Extend failed");
        toast.error(msg);
      }
    } catch {
      toast.error("Network error — couldn\u2019t extend");
    } finally {
      actionBusyRef.current = false;
      setInlineActionId(null);
    }
  };

  const handleConvert = async (bookingId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (actionBusyRef.current) return;
    actionBusyRef.current = true;
    setInlineActionId(bookingId);
    try {
      const res = await fetch(`/api/reservations/${bookingId}/convert`, { method: "POST" });
      if (handleAuthRedirect(res, "/")) return;
      if (res.ok) {
        toast.success("Converted to checkout");
        loadData();
      } else {
        const msg = await parseErrorMessage(res, "Convert failed");
        toast.error(msg);
      }
    } catch {
      toast.error("Network error — couldn\u2019t convert");
    } finally {
      actionBusyRef.current = false;
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
  const isFirstRun =
    data.stats.checkedOut === 0 && data.stats.overdue === 0 &&
    data.stats.reserved === 0 && data.stats.dueToday === 0 &&
    data.myCheckouts.total === 0 && data.teamCheckouts.total === 0 &&
    data.upcomingEvents.length === 0 && data.myReservations.length === 0 &&
    data.drafts.length === 0 && data.myShifts.length === 0;

  return (
    <PageTransition>
      {/* ══════ Page Header + Quick Actions ══════ */}
      <PageHeader title="Dashboard" className="mb-6 max-md:mb-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => loadData()}
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
      {isFirstRun && (
        <div className="relative bg-card border border-border rounded-xl mb-4 overflow-hidden animate-[empty-fade-in_0.4s_ease-out]">
          {/* Red accent stripe */}
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--wi-red)]" aria-hidden="true" />
          <div className="px-6 py-5 pl-8">
            <p
              className="text-[9px] uppercase tracking-[0.22em] text-muted-foreground/50 mb-1"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Getting started
            </p>
            <h2
              className="text-[20px] font-black leading-tight mb-4"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Welcome to Gear Tracker
            </h2>
            <div className="flex gap-3 max-md:flex-col">
              {[
                { href: "/items", label: "Add equipment", n: "01" },
                { href: "/import", label: "Import from spreadsheet", n: "02" },
                { href: "/settings/calendar-sources", label: "Set up calendar sync", n: "03" },
              ].map(({ href, label, n }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 py-2.5 px-3.5 border border-border rounded-lg no-underline flex-1 transition-colors hover:border-[var(--wi-red)]/30 hover:bg-[var(--wi-red)]/[0.03] group"
                >
                  <span
                    className="text-[11px] tabular-nums text-muted-foreground/40 group-hover:text-[var(--wi-red)]/60 transition-colors shrink-0"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {n}
                  </span>
                  <span
                    className="text-[13px] text-foreground/80"
                    style={{ fontFamily: "var(--font-heading)", fontWeight: 500 }}
                  >
                    {label}
                  </span>
                </Link>
              ))}
            </div>
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
          acting={inlineActionId !== null || deletingDraftId !== null}
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
            acting={inlineActionId !== null || deletingDraftId !== null}
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
        onUpdated={() => loadData()}
      />

      {/* Create flow is now at /checkouts/new and /reservations/new */}
    </PageTransition>
  );
}
