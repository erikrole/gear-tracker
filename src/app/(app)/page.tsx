"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
const BookingDetailsSheet = dynamic(() => import("@/components/BookingDetailsSheet"), { ssr: false });
import EmptyState from "@/components/EmptyState";
import { Progress } from "@/components/ui/progress";
import { RefreshCwIcon } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { formatRelativeTime } from "@/lib/format";

import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useDashboardFilters } from "@/hooks/use-dashboard-filters";
import { DashboardSkeleton } from "./dashboard/dashboard-skeleton";
import { FilterChips } from "./dashboard/filter-chips";
import { OverdueBanner } from "./dashboard/overdue-banner";
import { MyGearColumn } from "./dashboard/my-gear-column";
import { TeamActivityColumn } from "./dashboard/team-activity-column";
import type { BookingSummary } from "./dashboard-types";

export default function DashboardPage() {
  const { data, fetchError, refreshing, lastRefreshed, loadData, setData } = useDashboardData();
  const filters = useDashboardFilters(data);
  const [now, setNow] = useState(() => new Date());
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);
  const confirm = useConfirm();
  const { toast } = useToast();

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
      if (res.status === 401) { window.location.href = "/login?returnTo=/"; return; }
      if (res.ok) {
        toast("Draft deleted", "success");
      } else {
        setData((prev) => prev ? { ...prev, drafts: prevDrafts } : prev);
        toast("Failed to delete draft", "error");
      }
    } catch {
      setData((prev) => prev ? { ...prev, drafts: prevDrafts } : prev);
      toast("Network error \u2014 couldn\u2019t delete draft", "error");
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
      if (res.status === 401) { window.location.href = "/login?returnTo=/"; return; }
      if (res.ok) {
        toast("Extended by 1 day", "success");
        loadData(true);
      } else {
        const json = await res.json().catch(() => ({}));
        toast((json as Record<string, string>).error || "Extend failed", "error");
      }
    } catch {
      toast("Network error — couldn\u2019t extend", "error");
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
      if (res.status === 401) { window.location.href = "/login?returnTo=/"; return; }
      if (res.ok) {
        toast("Converted to checkout", "success");
        loadData(true);
      } else {
        const json = await res.json().catch(() => ({}));
        toast((json as Record<string, string>).error || "Convert failed", "error");
      }
    } catch {
      toast("Network error — couldn\u2019t convert", "error");
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

  return (
    <>
      {/* ══════ Page Header + Quick Actions ══════ */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <h1>Dashboard</h1>
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
        </div>
        <div className="flex items-center gap-2">
          <FilterChips {...filters} />
          <div className="quick-actions">
            <Button variant="outline" asChild><a href="/checkouts?create=true">New checkout</a></Button>
            <Button variant="outline" asChild><a href="/reservations?create=true">New reservation</a></Button>
          </div>
        </div>
      </div>

      {/* ══════ Stat Strip ══════ */}
      {refreshing && <Progress className="h-0.5 mb-1" />}
      <div className="stat-strip">
        <a href="/checkouts?filter=overdue" className={`stat-strip-item stat-strip-clickable ${data.stats.overdue > 0 ? "stat-strip-danger" : ""}`}>
          <span className="stat-strip-value">{data.stats.overdue}</span>
          <span className="stat-strip-label">Overdue</span>
        </a>
        <a href="/bookings?tab=checkouts&filter=due-today" className={`stat-strip-item stat-strip-clickable ${data.stats.dueToday > 0 ? "stat-strip-warning" : ""}`}>
          <span className="stat-strip-value">{data.stats.dueToday}</span>
          <span className="stat-strip-label">Due today</span>
        </a>
        <a href="/bookings?tab=checkouts" className="stat-strip-item stat-strip-clickable">
          <span className="stat-strip-value">{data.stats.checkedOut}</span>
          <span className="stat-strip-label">Active checkouts</span>
        </a>
        <a href="/bookings?tab=reservations" className="stat-strip-item stat-strip-clickable">
          <span className="stat-strip-value">{data.stats.reserved}</span>
          <span className="stat-strip-label">Reserved</span>
        </a>
      </div>

      {/* ══════ Welcome Banner (first-run) ══════ */}
      {data.stats.checkedOut === 0 && data.stats.overdue === 0 && data.stats.reserved === 0 && data.stats.dueToday === 0
        && data.myCheckouts.total === 0 && data.teamCheckouts.total === 0 && data.upcomingEvents.length === 0
        && data.myReservations.length === 0 && data.drafts.length === 0 && data.myShifts.length === 0 && (
        <div className="welcome-banner">
          <h2>Welcome to Gear Tracker</h2>
          <p>Get started by setting up your equipment inventory.</p>
          <div className="welcome-steps">
            <Link href="/items" className="welcome-step">
              <span className="welcome-step-num">1</span>
              <span>Add equipment</span>
            </Link>
            <Link href="/import" className="welcome-step">
              <span className="welcome-step-num">2</span>
              <span>Import from spreadsheet</span>
            </Link>
            <Link href="/settings/calendar-sources" className="welcome-step">
              <span className="welcome-step-num">3</span>
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

      {/* ══════ Two-Column Split ══════ */}
      <div className="dashboard-split">
        <MyGearColumn
          data={data}
          filtered={filters.filtered}
          activeSport={filters.activeSport}
          now={now}
          deletingDraftId={deletingDraftId}
          inlineActionId={inlineActionId}
          onSelectBooking={setSelectedBookingId}
          onDeleteDraft={handleDeleteDraft}
          onExtend={handleExtend}
          onConvert={handleConvert}
        />
        <TeamActivityColumn
          data={data}
          filtered={filters.filtered}
          activeSport={filters.activeSport}
          now={now}
          isStaff={data.role === "STAFF" || data.role === "ADMIN"}
          inlineActionId={inlineActionId}
          onSelectBooking={setSelectedBookingId}
          onExtend={handleExtend}
        />
      </div>

      {/* ══════ Booking Detail Sheet ══════ */}
      <BookingDetailsSheet
        bookingId={selectedBookingId}
        onClose={() => setSelectedBookingId(null)}
        onUpdated={() => loadData(true)}
      />
    </>
  );
}
