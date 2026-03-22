"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InlineTitle } from "@/components/InlineTitle";

import { useBookingDetail } from "@/hooks/useBookingDetail";
import { useBookingActions } from "@/hooks/useBookingActions";
import {
  statusBadgeVariant,
  toLocalDateTimeValue,
} from "@/components/booking-details/helpers";
import type { TabKey } from "@/components/booking-details/types";

import BookingInfoTab from "./BookingInfoTab";
import BookingEquipmentTab from "./BookingEquipmentTab";
import BookingHistoryTab from "./BookingHistoryTab";

/* ── Tab Definitions ── */

const tabDefs: Array<{ key: TabKey; label: string }> = [
  { key: "info", label: "Info" },
  { key: "equipment", label: "Equipment" },
  { key: "history", label: "History" },
];

/* ── Main Component ── */

export default function BookingDetailPage({
  kind,
}: {
  kind: "CHECKOUT" | "RESERVATION";
}) {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Data fetching
  const { booking, loading, error, reload, patchLocal } = useBookingDetail(id);

  // Actions
  const actions = useBookingActions(id, kind, reload);

  // Tabs
  const initialTab = (searchParams.get("tab") as TabKey) || "info";
  const [activeTab, setActiveTab] = useState<TabKey>(
    tabDefs.some((t) => t.key === initialTab) ? initialTab : "info",
  );

  function switchTab(tab: TabKey) {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    if (tab === "info") url.searchParams.delete("tab");
    else url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url.toString());
    // Silently refresh data when switching to history (picks up new audit entries)
    if (tab === "history") reload();
  }

  // Keyboard shortcuts: 1-3 to switch tabs
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      )
        return;
      const num = parseInt(e.key);
      if (num >= 1 && num <= tabDefs.length) {
        e.preventDefault();
        switchTab(tabDefs[num - 1].key);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Extend panel state
  const [showExtend, setShowExtend] = useState(false);
  const [extendDate, setExtendDate] = useState("");

  // Checkout-specific: checkin state
  const [checkinIds, setCheckinIds] = useState<Set<string>>(new Set());
  const [bulkReturnQty, setBulkReturnQty] = useState<Record<string, number>>({});

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
    await actions.checkinBulk(bulkItemId, qty);
    setBulkReturnQty((prev) => ({ ...prev, [bulkItemId]: 0 }));
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
  const isOverdue = booking
    ? kind === "CHECKOUT"
      ? isOpen && new Date(booking.endsAt) < new Date()
      : booking.status === "BOOKED" && new Date(booking.endsAt) < new Date()
    : false;

  const listPath = kind === "CHECKOUT" ? "/checkouts" : "/reservations";
  const kindLabel = kind === "CHECKOUT" ? "checkout" : "reservation";

  /* ── Loading state ── */

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-5 w-32 rounded-full" />
        </div>
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-9 w-24" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
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
          Back to {kindLabel}s
        </Link>
      </div>
    );
  }

  const itemCount = booking.serializedItems.length + booking.bulkItems.length;

  return (
    <>
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
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

        <div className="flex items-center gap-2 flex-wrap">
          {/* Primary CTA */}
          {canConvert && (
            <Button size="sm" onClick={actions.convert} disabled={!!actions.actionLoading}>
              {actions.actionLoading === "convert" ? "Converting..." : "Start checkout"}
            </Button>
          )}

          {/* Scan buttons for checkouts */}
          {kind === "CHECKOUT" && (isOpen || canOpen) && (
            <>
              {isOpen && (
                <Button size="sm" asChild>
                  <Link href={`/scan?checkout=${id}&phase=CHECKOUT`}>Scan Items Out</Link>
                </Button>
              )}
              {canCheckin && (
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/scan?checkout=${id}&phase=CHECKIN`}>Scan Items In</Link>
                </Button>
              )}
            </>
          )}

          {/* Secondary actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit && (
                <DropdownMenuItem
                  onSelect={() => router.push(`/${kindLabel}s?editId=${id}`)}
                >
                  Edit
                </DropdownMenuItem>
              )}
              {canExtend && (
                <DropdownMenuItem onSelect={() => setShowExtend((v) => !v)}>
                  Extend
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
        </div>
      </div>

      {/* ── Properties strip ── */}
      <div className="mt-4 mb-6 flex items-center gap-2 flex-wrap">
        <Badge variant={statusBadgeVariant[booking.status] || "gray"}>
          {booking.status.toLowerCase()}
        </Badge>
        {isOverdue && <Badge variant="red">overdue</Badge>}
        {booking.refNumber && (
          <Badge variant="outline" className="font-mono">
            {booking.refNumber}
          </Badge>
        )}
        {booking.location && <Badge variant="outline">{booking.location.name}</Badge>}
        <Badge variant="outline">{booking.requester?.name ?? "Unknown"}</Badge>
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

      {/* ── Action error ── */}
      {actions.actionError && (
        <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {actions.actionError}
          <button
            className="ml-2 underline text-xs"
            onClick={actions.clearError}
          >
            dismiss
          </button>
        </div>
      )}

      {/* ── Extend panel ── */}
      {showExtend && (
        <Card className="mb-4 p-4 border-border/40 shadow-none">
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

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={(v) => switchTab(v as TabKey)}>
        <TabsList className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
          {tabDefs.map((tab, i) => (
            <TabsTrigger key={tab.key} value={tab.key}>
              {tab.key === "equipment" ? `${tab.label} (${itemCount})` : tab.label}
              <kbd className="ml-1 hidden sm:inline-block text-[10px] text-muted-foreground/50 font-mono">
                {i + 1}
              </kbd>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* ── Tab content ── */}
      {activeTab === "info" && (
        <div className="mt-14 max-w-3xl">
          <BookingInfoTab
            booking={booking}
            canEdit={canEdit}
            onSave={actions.saveField}
            onPatch={patchLocal}
          />
        </div>
      )}

      {activeTab === "equipment" && (
        <div className="mt-14">
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
      )}

      {activeTab === "history" && (
        <Card className="mt-14 border-border/40 shadow-none max-w-3xl">
          <CardHeader>
            <CardTitle>Activity Log</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <BookingHistoryTab auditLogs={booking.auditLogs} />
          </CardContent>
        </Card>
      )}
    </>
  );
}
