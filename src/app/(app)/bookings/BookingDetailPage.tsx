"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
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
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Clock, ChevronDown, Copy } from "lucide-react";
import BookingDetailsSheet from "@/components/BookingDetailsSheet";
import { useToast } from "@/components/Toast";

import { useBookingDetail } from "@/hooks/useBookingDetail";
import { useBookingActions } from "@/hooks/useBookingActions";
import {
  statusBadgeVariant,
  statusLabel,
  toLocalDateTimeValue,
  actionLabels,
  formatRelative,
  urgencyBadgeClassName,
} from "@/components/booking-details/helpers";
import { formatCountdown, formatDateTime, getUrgency } from "@/lib/format";

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
  const { booking, loading, reloading, error, reload, patchLocal } = useBookingDetail(id);

  // Actions
  const actions = useBookingActions(id, kind, reload, booking?.updatedAt);

  // Extend panel state
  const [showExtend, setShowExtend] = useState(false);
  const [extendDate, setExtendDate] = useState("");

  // Checkout-specific: checkin state — select all returnable items by default
  const [checkinIds, setCheckinIds] = useState<Set<string>>(new Set());
  const [bulkReturnQty, setBulkReturnQty] = useState<Record<string, number>>({});
  const checkinIdsInitialised = useRef(false);

  // History collapse state
  const [historyExpanded, setHistoryExpanded] = useState(false);

  // Edit sheet state
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const { toast } = useToast();

  // Live countdown tick — faster for urgent/overdue bookings
  const [now, setNow] = useState(() => new Date());
  const liveUrgency = booking ? getUrgency(booking.startsAt, booking.endsAt, now) : "normal";
  useEffect(() => {
    const interval = liveUrgency === "overdue" || liveUrgency === "critical" ? 10_000 : 30_000;
    const timer = setInterval(() => setNow(new Date()), interval);
    return () => clearInterval(timer);
  }, [liveUrgency]);

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
    if (new Date(extendDate) <= new Date()) {
      toast("New end date must be in the future", "error");
      return;
    }
    const ok = await actions.extend(extendDate);
    if (ok) {
      setShowExtend(false);
      setExtendDate("");
    }
  }

  function handleQuickExtend(days: number) {
    if (!booking) return;
    // Offset from the currently picked date if set, otherwise from booking end
    const base = extendDate ? new Date(extendDate) : new Date(booking.endsAt);
    base.setDate(base.getDate() + days);
    setExtendDate(toLocalDateTimeValue(base));
    setShowExtend(true);
  }

  async function handleCheckinSelected() {
    const returning = Array.from(checkinIds);
    // Optimistically mark items as returned before API call
    const returningSet = new Set(returning);
    const previousItems = booking!.serializedItems;
    patchLocal({
      serializedItems: previousItems.map((item) =>
        returningSet.has(item.asset.id)
          ? { ...item, allocationStatus: "returned" }
          : item,
      ),
    });
    setCheckinIds(new Set());
    const ok = await actions.checkinItems(returning);
    if (ok) {
      // Allow auto-select to re-fire on reload for remaining items
      checkinIdsInitialised.current = false;
    } else {
      // Rollback optimistic update on failure
      patchLocal({ serializedItems: previousItems });
      setCheckinIds(returningSet);
    }
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
  const isOpen = booking?.status === "OPEN";
  const isActive = isOpen || booking?.status === "BOOKED";
  const hasAnyAction = canEdit || canExtend || canConvert || canCancel || canDuplicate || canCheckin;

  // Auto-select all returnable serialized items on first load
  useEffect(() => {
    if (checkinIdsInitialised.current || !booking || !canCheckin) return;
    const returnable = booking.serializedItems
      .filter((i) => i.allocationStatus !== "returned")
      .map((i) => i.asset.id);
    if (returnable.length > 0) {
      setCheckinIds(new Set(returnable));
      checkinIdsInitialised.current = true;
    }
  }, [booking, canCheckin]);

  // Keyboard shortcut: E to open edit sheet
  useEffect(() => {
    if (!canEdit) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "e" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setEditSheetOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canEdit]);

  const listPath = kind === "CHECKOUT" ? "/checkouts" : "/reservations";
  const kindLabel = kind === "CHECKOUT" ? "checkout" : "reservation";
  const kindLabelPlural = kind === "CHECKOUT" ? "Checkouts" : "Reservations";

  // Countdown for active bookings
  const countdown = booking && isActive ? formatCountdown(booking.endsAt, now) : null;
  const urgency = isActive ? liveUrgency : "normal";

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
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-1.5">
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



  return (
    <div className="space-y-6">
      {/* Breadcrumb handled by global PageBreadcrumb in AppShell */}

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <InlineTitle
            value={booking.title}
            canEdit={canEdit}
            onSave={async (v) => {
              await actions.saveField("title", v);
              patchLocal({ title: v });
            }}
            className="text-2xl font-semibold tracking-tight leading-tight"
            placeholder="Untitled booking"
          />
        </div>

        {hasAnyAction && <div className="flex items-center gap-2 shrink-0 overflow-x-auto">
          {/* Actions dropdown — secondary/less-common actions */}
          {(canDuplicate || canCancel || (kind === "CHECKOUT" && isOpen) || (kind === "CHECKOUT" && canCheckin)) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-1.5">
                  Actions
                  <ChevronDown className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {kind === "CHECKOUT" && isOpen && (
                  <DropdownMenuItem asChild>
                    <Link href={`/scan?checkout=${id}&phase=CHECKOUT`}>Scan items out</Link>
                  </DropdownMenuItem>
                )}
                {kind === "CHECKOUT" && canCheckin && (
                  <DropdownMenuItem asChild>
                    <Link href={`/scan?checkout=${id}&phase=CHECKIN`}>Scan items in</Link>
                  </DropdownMenuItem>
                )}
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

          {/* Promoted action buttons */}
          {canEdit && (
            <Button
              variant="outline"
              onClick={() => setEditSheetOpen(true)}
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

          {/* Primary CTA — rightmost, most prominent */}
          {canConvert && (
            <Button onClick={actions.convert} disabled={!!actions.actionLoading}>
              {actions.actionLoading === "convert" ? "Converting..." : "Start checkout"}
            </Button>
          )}
          {kind === "CHECKOUT" && canCheckin && (
            <Button onClick={() => router.push(`/scan?checkout=${id}&phase=CHECKIN`)}>
              Check in
            </Button>
          )}
        </div>}
      </div>

      {/* ── Status strip ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={statusBadgeVariant[booking.status] || "gray"}>
          {statusLabel(booking.status, kind)}
        </Badge>
        {booking.refNumber && (
          <Badge
            variant="outline"
            className="font-mono cursor-pointer hover:bg-muted/60 transition-colors gap-1"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(booking.refNumber!);
                toast("Copied to clipboard", "success");
              } catch {
                toast("Failed to copy", "error");
              }
            }}
            title="Click to copy"
          >
            {booking.refNumber}
            <Copy className="size-3 text-muted-foreground" />
          </Badge>
        )}
        {countdown && (
          <Badge
            variant="outline"
            className={`gap-1.5 font-medium ${urgencyBadgeClassName(urgency)}`}
          >
            <Clock className="size-3" />
            {countdown}
          </Badge>
        )}
        {reloading && (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground ml-auto">
            <Spinner className="size-3" />
            Refreshing…
          </span>
        )}
        {!reloading && booking.updatedAt && (
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
        <Card className="p-4 border-border/40 shadow-none space-y-3">
          <span className="text-sm font-medium">New end date</span>
          <DateTimePicker
            value={extendDate ? new Date(extendDate) : undefined}
            onChange={(d) => setExtendDate(toLocalDateTimeValue(d))}
            minDate={new Date(Math.max(new Date(booking.endsAt).getTime(), Date.now()))}
            placeholder="Select new end date"
          />
          <div className="flex items-center gap-2 flex-wrap">
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
            <span className="border-l border-border/40 h-5 mx-1" />
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
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-1.5">
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
            onSelectAll={() => {
              const all = booking.serializedItems
                .filter((i) => i.allocationStatus !== "returned")
                .map((i) => i.asset.id);
              setCheckinIds(new Set(all));
            }}
            onClearSelection={() => setCheckinIds(new Set())}
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
        <Collapsible open={historyExpanded} onOpenChange={setHistoryExpanded}>
          <Card className="border-border/40 shadow-none">
            <CardHeader className="pb-0">
              <CollapsibleTrigger className="flex items-center gap-2 w-full text-left">
                <ChevronDown className={`size-4 transition-transform ${historyExpanded ? "" : "-rotate-90"}`} />
                <CardTitle className="text-base">
                  Activity
                  <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                    ({booking.auditLogs.length})
                  </span>
                </CardTitle>
              </CollapsibleTrigger>
              {/* Collapsed preview: show latest entry */}
              {!historyExpanded && booking.auditLogs[0] && (
                <p className="text-xs text-muted-foreground mt-1.5 ml-6 truncate">
                  {booking.auditLogs[0].actor?.name ?? "Unknown"}{" "}
                  {actionLabels[booking.auditLogs[0].action] || booking.auditLogs[0].action}{" "}
                  — {formatRelative(booking.auditLogs[0].createdAt)}{" · "}{formatDateTime(booking.auditLogs[0].createdAt)}
                </p>
              )}
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="p-0 pt-2">
                <BookingHistoryTab auditLogs={booking.auditLogs} />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* ── Edit sheet ── */}
      <BookingDetailsSheet
        bookingId={editSheetOpen ? id : null}
        onClose={() => setEditSheetOpen(false)}
        onUpdated={() => {
          setEditSheetOpen(false);
          reload();
        }}
      />
    </div>
  );
}
