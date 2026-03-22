"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InlineTitle } from "@/components/InlineTitle";
import { Clock, ChevronRight, ChevronDown } from "lucide-react";

import { useBookingDetail } from "@/hooks/useBookingDetail";
import { useBookingActions } from "@/hooks/useBookingActions";
import {
  statusBadgeVariant,
  toLocalDateTimeValue,
} from "@/components/booking-details/helpers";
import { formatCountdown, getUrgency } from "@/lib/format";

import BookingInfoTab from "./BookingInfoTab";
import BookingEquipmentTab from "./BookingEquipmentTab";
import BookingHistoryTab from "./BookingHistoryTab";

/* ── Main Component ── */

export default function BookingDetailPage({
  kind,
}: {
  kind: "CHECKOUT" | "RESERVATION";
}) {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  // Data fetching
  const { booking, loading, error, reload, patchLocal } = useBookingDetail(id);

  // Actions
  const actions = useBookingActions(id, kind, reload);

  // Extend panel state
  const [showExtend, setShowExtend] = useState(false);
  const [extendDate, setExtendDate] = useState("");

  // Checkout-specific: checkin state
  const [checkinIds, setCheckinIds] = useState<Set<string>>(new Set());
  const [bulkReturnQty, setBulkReturnQty] = useState<Record<string, number>>({});

  // History collapse state
  const [historyExpanded, setHistoryExpanded] = useState(false);

  // Live countdown tick
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const toggleCheckin = useCallback((assetId: string) => {
    setCheckinIds((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  }, []);

  async function handleExtend() {
    if (!extendDate) return;
    const ok = await actions.extend(extendDate);
    if (ok) {
      setShowExtend(false);
      setExtendDate("");
    }
  }

  function handleQuickExtend(days: number) {
    if (!booking) return;
    const current = new Date(booking.endsAt);
    current.setDate(current.getDate() + days);
    setExtendDate(toLocalDateTimeValue(current));
    setShowExtend(true);
  }

  async function handleCheckinSelected() {
    await actions.checkinItems(Array.from(checkinIds));
    setCheckinIds(new Set());
  }

  async function handleBulkReturn(bulkItemId: string) {
    const qty = bulkReturnQty[bulkItemId];
    if (!qty || qty <= 0) return;
    const ok = await actions.checkinBulk(bulkItemId, qty);
    if (ok) setBulkReturnQty((prev) => ({ ...prev, [bulkItemId]: 0 }));
  }

  // Derived
  const allowedActions = booking?.allowedActions ?? [];
  const canEdit = allowedActions.includes("edit");
  const canExtend = allowedActions.includes("extend");
  const canCancel = allowedActions.includes("cancel");
  const canCheckin = allowedActions.includes("checkin");
  const canConvert = kind === "RESERVATION" && allowedActions.includes("convert");
  const canDuplicate = kind === "RESERVATION" && allowedActions.includes("duplicate");
  const canOpen = allowedActions.includes("open");
  const isOpen = booking?.status === "OPEN";
  const isActive = isOpen || booking?.status === "BOOKED";

  const listPath = kind === "CHECKOUT" ? "/checkouts" : "/reservations";
  const kindLabel = kind === "CHECKOUT" ? "checkout" : "reservation";
  const kindLabelPlural = kind === "CHECKOUT" ? "Checkouts" : "Reservations";

  // Countdown for active bookings
  const countdown = booking && isActive ? formatCountdown(booking.endsAt, now) : null;
  const urgency = booking && isActive ? getUrgency(booking.startsAt, booking.endsAt, now) : "normal";

  /* ── Loading state ── */

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-8 w-64" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-5 w-48 rounded-full" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6">
          <Skeleton className="h-72 rounded-lg" />
          <Skeleton className="h-72 rounded-lg" />
        </div>
      </div>
    );
  }

  /* ── Error state ── */

  if (error || !booking) {
    return (
      <div className="py-10 px-5 text-center text-muted-foreground">
        {kindLabel.charAt(0).toUpperCase() + kindLabel.slice(1)} not found or failed to
        load.{" "}
        <Link href={listPath} className="text-blue-600 hover:underline">
          Back to {kindLabelPlural.toLowerCase()}
        </Link>
      </div>
    );
  }

  const itemCount = booking.serializedItems.length + booking.bulkItems.length;
  const HISTORY_PREVIEW_COUNT = 5;
  const visibleLogs = historyExpanded
    ? booking.auditLogs
    : booking.auditLogs.slice(0, HISTORY_PREVIEW_COUNT);

  return (
    <div className="space-y-6">
      {/* ── Breadcrumb ── */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground transition-colors">
          Home
        </Link>
        <ChevronRight className="size-3.5" />
        <Link href={listPath} className="hover:text-foreground transition-colors">
          {kindLabelPlural}
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="text-foreground font-medium truncate max-w-[200px]">
          {booking.title}
        </span>
      </nav>

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <InlineTitle
            value={booking.title}
            canEdit={canEdit}
            onSave={async (v) => {
              await actions.saveField("title", v);
              patchLocal({ title: v });
            }}
            className="text-2xl font-bold tracking-tight"
            placeholder="Untitled booking"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {/* Primary CTA */}
          {canConvert && (
            <Button onClick={actions.convert} disabled={!!actions.actionLoading}>
              {actions.actionLoading === "convert" ? "Converting..." : "Start checkout"}
            </Button>
          )}

          {/* Scan buttons for checkouts */}
          {kind === "CHECKOUT" && isOpen && (
            <Button asChild>
              <Link href={`/scan?checkout=${id}&phase=CHECKOUT`}>Scan Items Out</Link>
            </Button>
          )}
          {kind === "CHECKOUT" && canCheckin && (
            <Button variant="outline" asChild>
              <Link href={`/scan?checkout=${id}&phase=CHECKIN`}>Scan Items In</Link>
            </Button>
          )}

          {/* Promoted actions */}
          {canEdit && (
            <Button
              variant="outline"
              onClick={() => router.push(`/${kindLabel}s?editId=${id}`)}
            >
              Edit
            </Button>
          )}
          {canExtend && (
            <Button
              variant="outline"
              onClick={() => {
                setShowExtend((v) => {
                  if (!v && booking) setExtendDate(toLocalDateTimeValue(new Date(booking.endsAt)));
                  return !v;
                });
              }}
            >
              Extend
            </Button>
          )}

          {/* Secondary actions dropdown */}
          {(canDuplicate || canCancel || (kind === "CHECKOUT" && canCheckin)) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canDuplicate && (
                  <DropdownMenuItem
                    onSelect={actions.duplicate}
                    disabled={!!actions.actionLoading}
                  >
                    {actions.actionLoading === "duplicate" ? "Duplicating..." : "Duplicate"}
                  </DropdownMenuItem>
                )}
                {kind === "CHECKOUT" && canCheckin && (
                  <DropdownMenuItem
                    onSelect={actions.completeCheckin}
                    disabled={!!actions.actionLoading}
                  >
                    {actions.actionLoading === "complete-checkin" ? "Completing..." : "Complete check in"}
                  </DropdownMenuItem>
                )}
                {canCancel && (
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={actions.cancel}
                    disabled={!!actions.actionLoading}
                  >
                    {actions.actionLoading === "cancel" ? "Cancelling..." : "Cancel"}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* ── Status strip ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={statusBadgeVariant[booking.status] || "gray"}>
          {booking.status.toLowerCase()}
        </Badge>
        {booking.refNumber && (
          <Badge variant="outline" className="font-mono">
            {booking.refNumber}
          </Badge>
        )}
        {countdown && (
          <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${
            urgency === "overdue"
              ? "text-red-600 dark:text-red-400"
              : urgency === "critical"
                ? "text-orange-600 dark:text-orange-400"
                : urgency === "warning"
                  ? "text-yellow-600 dark:text-yellow-500"
                  : "text-muted-foreground"
          }`}>
            <Clock className="size-3.5" />
            {countdown}
          </span>
        )}
        {booking.updatedAt && (
          <span className="text-xs text-muted-foreground ml-auto">
            Updated{" "}
            {new Date(booking.updatedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        )}
      </div>

      {/* ── Extend panel ── */}
      {showExtend && (
        <Card className="p-4 border-border/40 shadow-none">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold">New end date:</span>
            <DateTimePicker
              value={extendDate ? new Date(extendDate) : undefined}
              onChange={(d) => setExtendDate(toLocalDateTimeValue(d))}
              minDate={new Date(booking.endsAt)}
              placeholder="Select new end date"
            />
            <Button
              size="sm"
              onClick={handleExtend}
              disabled={!extendDate || !!actions.actionLoading}
            >
              {actions.actionLoading === "extend" ? "Saving..." : "Save"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setShowExtend(false); setExtendDate(""); }}
            >
              Cancel
            </Button>
          </div>
          <div className="flex gap-2 mt-2">
            {[
              { label: "+1 day", days: 1 },
              { label: "+3 days", days: 3 },
              { label: "+1 week", days: 7 },
            ].map(({ label, days }) => (
              <Button
                key={days}
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => handleQuickExtend(days)}
              >
                {label}
              </Button>
            ))}
          </div>
        </Card>
      )}

      {/* ── Two-column layout: Info + Equipment ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6">
        {/* Left: Info card */}
        <div>
          <BookingInfoTab
            booking={booking}
            canEdit={canEdit}
            onSave={actions.saveField}
            onPatch={patchLocal}
          />
        </div>

        {/* Right: Equipment card */}
        <div>
          <BookingEquipmentTab
            booking={booking}
            canCheckin={kind === "CHECKOUT" && canCheckin}
            checkinIds={checkinIds}
            onToggleCheckin={toggleCheckin}
            onCheckinSelected={handleCheckinSelected}
            bulkReturnQty={bulkReturnQty}
            onBulkReturnQtyChange={(itemId, qty) =>
              setBulkReturnQty((prev) => ({ ...prev, [itemId]: qty }))
            }
            onBulkReturn={handleBulkReturn}
            actionLoading={actions.actionLoading}
          />
        </div>
      </div>

      {/* ── History section (inline, collapsible) ── */}
      {booking.auditLogs.length > 0 && (
        <Card className="border-border/40 shadow-none">
          <CardHeader className="pb-0">
            <button
              onClick={() => setHistoryExpanded((v) => !v)}
              className="flex items-center gap-2 w-full text-left"
            >
              <ChevronDown className={`size-4 transition-transform ${historyExpanded ? "" : "-rotate-90"}`} />
              <CardTitle className="text-base">
                Activity
                <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                  ({booking.auditLogs.length})
                </span>
              </CardTitle>
            </button>
          </CardHeader>
          <CardContent className="p-0 pt-2">
            <BookingHistoryTab auditLogs={visibleLogs} />
            {booking.auditLogs.length > HISTORY_PREVIEW_COUNT && !historyExpanded && (
              <div className="px-3 pb-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs w-full"
                  onClick={() => setHistoryExpanded(true)}
                >
                  Show all {booking.auditLogs.length} entries
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
