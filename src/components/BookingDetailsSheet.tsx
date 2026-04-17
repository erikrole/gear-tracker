"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { useConfirm } from "@/components/ConfirmDialog";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetBody,
  SheetFooter,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { handleAuthRedirect, parseErrorMessage } from "@/lib/errors";
import { statusBadgeVariant } from "./booking-details/helpers";
import { toLocalDateTimeValue } from "./booking-details/helpers";
import {
  BookingOverview,
  BookingEditForm,
  BookingItems,
  ScanToReturnView,
} from "./booking-details";
import { useCheckinScan } from "./booking-details/useCheckinScan";
import EquipmentPicker, { type PickerBulkSku } from "@/components/EquipmentPicker";
import ActivityTimeline from "@/components/ActivityTimeline";
import Link from "next/link";
import { ExternalLinkIcon } from "lucide-react";
import type {
  BookingDetail,
  BulkSkuOption,
  ConflictData,
} from "./booking-details/types";

/* ───── Props ───── */

type Props = {
  bookingId: string | null;
  onClose: () => void;
  onUpdated?: () => void;
  currentUserRole?: string;
  initialTab?: "details" | "equipment" | "history" | null;
};

/* ───── Section heading ───── */

function SectionHead({
  label,
  right,
}: {
  label: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-muted/20">
      <span
        className="h-[18px] w-[3px] shrink-0 rounded-full"
        style={{ backgroundColor: "var(--wi-red)" }}
      />
      <span className="text-[11px] font-black uppercase tracking-[0.15em] flex-1 text-foreground">
        {label}
      </span>
      {right}
    </div>
  );
}

/* ───── Component ───── */

export default function BookingDetailsSheet({
  bookingId,
  onClose,
  onUpdated,
  currentUserRole: _currentUserRole,
  initialTab: _initialTab,
}: Props) {
  const confirm = useConfirm();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [equipSearch, setEquipSearch] = useState("");

  // Edit form state
  const [editTitle, setEditTitle] = useState("");
  const [editEndsAt, setEditEndsAt] = useState("");
  const [editStartsAt, setEditStartsAt] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Equipment editing state
  const [equipEditMode, setEquipEditMode] = useState(false);
  const [editSerializedIds, setEditSerializedIds] = useState<string[]>([]);
  const [editBulkItems, setEditBulkItems] = useState<
    { bulkSkuId: string; quantity: number }[]
  >([]);
  const [bulkSkus, setBulkSkus] = useState<BulkSkuOption[]>([]);
  const [equipSaving, setEquipSaving] = useState(false);
  const [conflictError, setConflictError] = useState<ConflictData | null>(null);
  const [optionsError, setOptionsError] = useState(false);

  // Audit log pagination
  const [extraAuditLogs, setExtraAuditLogs] = useState<BookingDetail["auditLogs"]>([]);
  const [auditLogCursor, setAuditLogCursor] = useState<string | null>(null);
  const [hasMoreAuditLogs, setHasMoreAuditLogs] = useState(false);
  const [loadingMoreAuditLogs, setLoadingMoreAuditLogs] = useState(false);

  const [fetchError, setFetchError] = useState(false);

  const [extending, setExtending] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [converting, setConverting] = useState(false);
  const [checkinLoading, setCheckinLoading] = useState(false);

  /* ───── Data fetching ───── */

  const abortRef = useRef<AbortController | null>(null);

  const fetchBooking = useCallback(async (opts?: { silent?: boolean }) => {
    if (!bookingId) return;
    if (!opts?.silent) setLoading(true);
    setFetchError(false);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetchWithTimeout(`/api/bookings/${bookingId}`, {
        signal: controller.signal,
      });
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        const json = await res.json();
        if (json?.data) {
          setBooking(json.data);
          setExtraAuditLogs([]);
          setAuditLogCursor(json.data.auditLogNextCursor ?? null);
          setHasMoreAuditLogs(json.data.hasMoreAuditLogs ?? false);
        }
      } else {
        if (!opts?.silent) setFetchError(true);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (!opts?.silent) setFetchError(true);
    }
    setLoading(false);
  }, [bookingId]);

  useEffect(() => {
    if (bookingId) {
      fetchBooking();
      setEditMode(false);
      setEquipEditMode(false);
      setConflictError(null);
    }
    return () => { abortRef.current?.abort(); };
  }, [bookingId, fetchBooking]);

  const loadFormOptions = useCallback(async () => {
    try {
      setOptionsError(false);
      const res = await fetchWithTimeout("/api/form-options");
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        const json = await res.json();
        setBulkSkus(json.data.bulkSkus || []);
      } else {
        setOptionsError(true);
      }
    } catch {
      setOptionsError(true);
      toast.error("Failed to load equipment options");
    }
  }, []);

  /* ───── Audit log load-more ───── */

  const loadMoreAuditLogs = useCallback(async () => {
    if (!bookingId || !auditLogCursor || loadingMoreAuditLogs) return;
    setLoadingMoreAuditLogs(true);
    try {
      const res = await fetchWithTimeout(
        `/api/bookings/${bookingId}/audit-logs?cursor=${encodeURIComponent(auditLogCursor)}`
      );
      if (res.ok) {
        const json = await res.json();
        setExtraAuditLogs((prev) => [...prev, ...(json.data ?? [])]);
        setAuditLogCursor(json.nextCursor ?? null);
        setHasMoreAuditLogs(json.hasMore ?? false);
      }
    } catch {
      // silently fail
    }
    setLoadingMoreAuditLogs(false);
  }, [bookingId, auditLogCursor, loadingMoreAuditLogs]);

  /* ───── Derived state ───── */

  const checkinProgress = useMemo(() => {
    if (!booking || booking.kind !== "CHECKOUT" || booking.status !== "OPEN") return null;
    const items = booking.serializedItems ?? [];
    const total = items.length;
    if (total === 0) return null;
    const returned = items.filter((i) => i.allocationStatus === "returned").length;
    return { returned, total, percent: Math.round((returned / total) * 100) };
  }, [booking]);

  const allAuditLogs = useMemo(() => {
    if (!booking) return [];
    return [...(booking.auditLogs ?? []), ...extraAuditLogs];
  }, [booking, extraAuditLogs]);


  const returnSuggestion = useMemo(() => {
    if (!booking) return null;
    if (booking.locationMode === "SINGLE") {
      return `Return to ${booking.itemLocations[0]?.name || booking.location.name}`;
    }
    const names = booking.itemLocations.map((l) => l.name);
    return `Return to both: ${names.join(" + ")}`;
  }, [booking]);

  /* ───── Permission flags ───── */

  const actions = booking?.allowedActions ?? [];
  const canEdit = booking && actions.includes("edit");
  const canCancel = booking && actions.includes("cancel");
  const canExtend = booking && actions.includes("extend");
  const canCheckin = booking && booking.kind === "CHECKOUT" && actions.includes("checkin");
  const canConvert = booking && booking.kind === "RESERVATION" && actions.includes("convert");
  const canEditEquipment = canEdit;

  /* ───── Scan-to-return ───── */

  const unreturnedCount = (booking?.serializedItems ?? []).filter(
    (i) => i.allocationStatus !== "returned"
  ).length;

  const checkinScan = useCheckinScan({
    booking: booking ?? { id: "", kind: "CHECKOUT", serializedItems: [] } as unknown as BookingDetail,
    onItemCheckedIn: () => fetchBooking({ silent: true }),
  });

  /* ───── Filtered equipment ───── */

  const filteredSerializedItems = (booking?.serializedItems ?? []).filter((item) => {
    if (!equipSearch) return true;
    const q = equipSearch.toLowerCase();
    return (
      item.asset.assetTag.toLowerCase().includes(q) ||
      item.asset.brand.toLowerCase().includes(q) ||
      item.asset.model.toLowerCase().includes(q) ||
      item.asset.serialNumber.toLowerCase().includes(q)
    );
  });

  const filteredBulkItems = (booking?.bulkItems ?? []).filter((item) => {
    if (!equipSearch) return true;
    return item.bulkSku.name.toLowerCase().includes(equipSearch.toLowerCase());
  });

  const totalEquipItems =
    (booking?.serializedItems?.length ?? 0) + (booking?.bulkItems?.length ?? 0);

  /* ───── Handlers ───── */

  function enterEditMode() {
    if (!booking) return;
    setEditTitle(booking.title);
    setEditStartsAt(toLocalDateTimeValue(new Date(booking.startsAt)));
    setEditEndsAt(toLocalDateTimeValue(new Date(booking.endsAt)));
    setEditNotes(booking.notes || "");
    setEditMode(true);
  }

  function enterEquipEditMode() {
    if (!booking) return;
    setEditSerializedIds((booking.serializedItems ?? []).map((i) => i.asset.id));
    setEditBulkItems(
      (booking.bulkItems ?? []).map((i) => ({
        bulkSkuId: i.bulkSku.id,
        quantity: i.plannedQuantity,
      }))
    );
    setEquipEditMode(true);
    setConflictError(null);
    loadFormOptions();
  }

  async function handleEquipSave() {
    if (!booking || equipSaving) return;
    setEquipSaving(true);
    setConflictError(null);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (booking.updatedAt) headers["If-Unmodified-Since"] = new Date(booking.updatedAt).toUTCString();
      const res = await fetchWithTimeout(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          serializedAssetIds: editSerializedIds,
          bulkItems: editBulkItems,
        }),
      });

      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        toast.success("Equipment updated");
        setEquipEditMode(false);
        await fetchBooking({ silent: true });
        onUpdated?.();
      } else {
        const json = await res.json().catch(() => ({}) as Record<string, unknown>);
        if (res.status === 409 && json.data) setConflictError(json.data as ConflictData);
        toast.error((json.error as string) || "Failed to save equipment changes");
      }
    } catch {
      toast.error("Failed to save");
    }
    setEquipSaving(false);
  }

  async function handleSave() {
    if (!booking || saving) return;
    setSaving(true);

    const payload: Record<string, unknown> = {};
    if (editTitle !== booking.title) payload.title = editTitle;
    if (editNotes !== (booking.notes || "")) payload.notes = editNotes;

    const newEndsAt = new Date(editEndsAt).toISOString();
    if (newEndsAt !== booking.endsAt) payload.endsAt = newEndsAt;

    if (booking.kind === "RESERVATION") {
      const newStartsAt = new Date(editStartsAt).toISOString();
      if (newStartsAt !== booking.startsAt) payload.startsAt = newStartsAt;
    }

    if (Object.keys(payload).length === 0) {
      toast.info("No changes to save");
      setSaving(false);
      return;
    }

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (booking.updatedAt) headers["If-Unmodified-Since"] = new Date(booking.updatedAt).toUTCString();
      const res = await fetchWithTimeout(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(payload),
      });

      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        toast.success("Booking updated");
        setEditMode(false);
        await fetchBooking({ silent: true });
        onUpdated?.();
      } else {
        const json = await res.json().catch(() => ({}) as Record<string, unknown>);
        if (res.status === 409 && json.data) setConflictError(json.data as ConflictData);
        toast.error((json.error as string) || "Failed to save");
      }
    } catch {
      toast.error("Failed to save");
    }
    setSaving(false);
  }

  async function handleSaveDate(field: "startsAt" | "endsAt", iso: string) {
    if (!booking) return;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (booking.updatedAt) headers["If-Unmodified-Since"] = new Date(booking.updatedAt).toUTCString();
    const res = await fetchWithTimeout(`/api/bookings/${booking.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ [field]: iso }),
    });
    if (handleAuthRedirect(res)) return;
    if (!res.ok) {
      const json = await res.json().catch(() => ({}) as Record<string, unknown>);
      if (res.status === 409 && json.data) setConflictError(json.data as ConflictData);
      throw new Error((json.error as string) || "Failed to save date");
    }
    await fetchBooking({ silent: true });
    onUpdated?.();
  }

  async function handleExtendTo(endsAt: string) {
    if (!booking || extending) return;
    setExtending(true);
    try {
      const res = await fetchWithTimeout(`/api/bookings/${booking.id}/extend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endsAt }),
      });
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        const newDate = new Date(endsAt).toLocaleDateString("en-US", {
          month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
        });
        toast.success(`Extended to ${newDate}`);
        await fetchBooking({ silent: true });
        onUpdated?.();
      } else {
        const msg = await parseErrorMessage(res, "Failed to extend");
        toast.error(msg);
      }
    } catch {
      toast.error("Failed to extend");
    }
    setExtending(false);
  }

  async function handleCancel() {
    if (!booking || cancelling) return;
    const typeLabel = booking.kind === "RESERVATION" ? "reservation" : "checkout";
    const ok = await confirm({
      title: `Cancel ${typeLabel}`,
      message: `Cancel "${booking.title}"? This will release all equipment and cannot be undone.`,
      confirmLabel: `Cancel ${typeLabel}`,
      variant: "danger",
    });
    if (!ok) return;

    setCancelling(true);
    try {
      const res = await fetchWithTimeout(`/api/bookings/${booking.id}/cancel`, { method: "POST" });
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        toast.success("Booking cancelled");
        await fetchBooking({ silent: true });
        onUpdated?.();
      } else {
        const msg = await parseErrorMessage(res, "Failed to cancel");
        toast.error(msg);
      }
    } catch {
      toast.error("Failed to cancel");
    }
    setCancelling(false);
  }

  async function handleConvert() {
    if (!booking || converting) return;
    const ok = await confirm({
      title: "Convert to checkout",
      message: "Convert this reservation to a checkout? The reservation will be cancelled and a new checkout created.",
      confirmLabel: "Start checkout",
    });
    if (!ok) return;

    setConverting(true);
    try {
      const res = await fetchWithTimeout(`/api/reservations/${booking.id}/convert`, { method: "POST" });
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        const json = await res.json();
        toast.success("Converted to checkout");
        onUpdated?.();
        onClose();
        window.location.href = `/checkouts/${json.data.id}`;
      } else {
        const msg = await parseErrorMessage(res, "Failed to convert");
        toast.error(msg);
      }
    } catch {
      toast.error("Failed to convert");
    }
    setConverting(false);
  }

  async function handleCheckinItem(assetId: string) {
    if (!booking || checkinLoading) return;
    setCheckinLoading(true);
    const item = (booking.serializedItems ?? []).find((i) => i.asset.id === assetId);
    try {
      const res = await fetchWithTimeout(`/api/checkouts/${booking.id}/checkin-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetIds: [assetId] }),
      });
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        toast.success(`${item?.asset.assetTag ?? "Item"} checked in`);
        await fetchBooking({ silent: true });
        onUpdated?.();
      } else {
        const msg = await parseErrorMessage(res, "Failed to check in");
        toast.error(msg);
      }
    } catch {
      toast.error("Failed to check in");
    }
    setCheckinLoading(false);
  }

  async function handleCheckinAll() {
    if (!booking || checkinLoading) return;
    const activeItems = (booking.serializedItems ?? []).filter((i) => i.allocationStatus !== "returned");
    if (activeItems.length === 0) return;
    const ok = await confirm({
      title: "Check in all items",
      message: `Check in all ${activeItems.length} remaining item(s)?`,
      confirmLabel: "Check in all",
    });
    if (!ok) return;

    setCheckinLoading(true);
    try {
      const res = await fetchWithTimeout(`/api/checkouts/${booking.id}/checkin-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetIds: activeItems.map((i) => i.asset.id) }),
      });
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        toast.success("All items checked in");
        await fetchBooking({ silent: true });
        onUpdated?.();
      } else {
        const msg = await parseErrorMessage(res, "Failed to check in");
        toast.error(msg);
      }
    } catch {
      toast.error("Failed to check in");
    }
    setCheckinLoading(false);
  }

  /* ───── Render ───── */

  const detailHref = booking
    ? booking.kind === "CHECKOUT"
      ? `/checkouts/${booking.id}`
      : `/reservations/${booking.id}`
    : "#";

  return (
    <Sheet open={!!bookingId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="sm:max-w-lg flex flex-col">

        {/* Header */}
        <SheetHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <SheetTitle className="truncate">
                {booking?.title || "Loading..."}
              </SheetTitle>
              {booking && (
                <p className="text-[11px] text-white/55 mt-0.5 leading-relaxed">
                  {booking.refNumber && <span className="font-mono">{booking.refNumber}</span>}
                  {booking.refNumber && " \u00b7 "}
                  {booking.bookingType}
                  {booking.requester?.name && ` \u00b7 ${booking.requester.name}`}
                  {booking.location?.name && ` \u00b7 ${booking.location.name}`}
                </p>
              )}
            </div>
            {booking && (
              <Badge
                variant={(booking.isOverdue ? "red" : (statusBadgeVariant[booking.status] || "gray")) as BadgeProps["variant"]}
                className="shrink-0 mt-0.5"
              >
                {booking.isOverdue ? "overdue" : booking.status.toLowerCase()}
              </Badge>
            )}
          </div>
        </SheetHeader>

        {/* Body — single scrollable column */}
        <SheetBody className="px-0 py-0 flex flex-col relative">
          {loading ? (
            <div className="space-y-3 px-6 py-5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-3/5" />
            </div>
          ) : fetchError ? (
            <div className="py-10 px-6 text-center space-y-3">
              <p className="text-muted-foreground">Failed to load booking details.</p>
              <Button variant="outline" size="sm" onClick={() => fetchBooking()}>Retry</Button>
            </div>
          ) : !booking ? (
            <div className="py-10 px-6 text-center text-muted-foreground">Booking not found</div>
          ) : editMode ? (

            /* ── Edit mode ── */
            <div className="px-6 py-5 flex-1">
              <BookingEditForm
                booking={booking}
                editTitle={editTitle}
                editStartsAt={editStartsAt}
                editEndsAt={editEndsAt}
                editNotes={editNotes}
                saving={saving}
                onEditTitle={setEditTitle}
                onEditStartsAt={setEditStartsAt}
                onEditEndsAt={setEditEndsAt}
                onEditNotes={setEditNotes}
                onSave={handleSave}
                onCancel={() => setEditMode(false)}
              />
            </div>

          ) : equipEditMode ? (

            /* ── Equipment edit mode ── */
            <div className="px-6 py-4 flex flex-col gap-3 flex-1">
              {optionsError && (
                <Alert variant="destructive">
                  <AlertDescription className="flex items-center justify-between">
                    <span>Failed to load equipment options.</span>
                    <Button variant="outline" size="sm" onClick={loadFormOptions}>Retry</Button>
                  </AlertDescription>
                </Alert>
              )}
              {conflictError?.conflicts && conflictError.conflicts.length > 0 && (
                <Alert variant="destructive">
                  <AlertDescription>
                    <strong className="block mb-1">Scheduling conflict</strong>
                    {conflictError.conflicts.map((c, i) => (
                      <div key={i} className="text-xs">
                        {c.conflictingBookingTitle ? `"${c.conflictingBookingTitle}"` : "Another booking"}
                      </div>
                    ))}
                  </AlertDescription>
                </Alert>
              )}
              <EquipmentPicker
                bulkSkus={bulkSkus as unknown as PickerBulkSku[]}
                selectedAssetIds={editSerializedIds}
                setSelectedAssetIds={setEditSerializedIds}
                selectedBulkItems={editBulkItems.map((bi) => ({ bulkSkuId: bi.bulkSkuId, quantity: bi.quantity }))}
                setSelectedBulkItems={(updater) => {
                  if (typeof updater === "function") {
                    setEditBulkItems((prev) => {
                      const result = updater(prev.map((bi) => ({ bulkSkuId: bi.bulkSkuId, quantity: bi.quantity })));
                      return result;
                    });
                  } else {
                    setEditBulkItems(updater);
                  }
                }}
                startsAt={booking.startsAt}
                endsAt={booking.endsAt}
                locationId={booking.location.id}
              />
              <div className="flex gap-2">
                <Button disabled={equipSaving} onClick={handleEquipSave}>
                  {equipSaving ? "Saving..." : "Save equipment"}
                </Button>
                <Button variant="outline" onClick={() => { setEquipEditMode(false); setConflictError(null); }}>
                  Cancel
                </Button>
              </div>
            </div>

          ) : (

            /* ── Normal single-scroll view ── */
            <>
              {/* ─ Details section ─ */}
              <div className="border-b border-border">
                <div className="px-6 py-4">
                  <BookingOverview
                    booking={booking}
                    conflictError={conflictError}
                    returnSuggestion={returnSuggestion}
                    checkinProgress={checkinProgress}
                    canExtend={!!canExtend}
                    extending={extending}
                    onExtendTo={handleExtendTo}
                    canEdit={!!canEdit}
                    onSaveDate={handleSaveDate}
                  />
                </div>
              </div>

              {/* ─ Equipment section ─ */}
              <div className="border-b border-border">
                <SectionHead
                  label={`Equipment${totalEquipItems > 0 ? ` \u00b7 ${totalEquipItems}` : ""}`}
                  right={
                    canEditEquipment ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={enterEquipEditMode}
                      >
                        Edit
                      </Button>
                    ) : undefined
                  }
                />

                {/* Scan to return */}
                {canCheckin && (
                  <div className="px-6 pt-3 pb-0">
                    <ScanToReturnView
                      scanning={checkinScan.scanning}
                      setScanning={checkinScan.setScanning}
                      cameraError={checkinScan.cameraError}
                      setCameraError={checkinScan.setCameraError}
                      feedback={checkinScan.feedback}
                      setFeedback={checkinScan.setFeedback}
                      onScan={checkinScan.handleScan}
                    />
                  </div>
                )}

                <div className="px-6 py-4">
                  <BookingItems
                    booking={booking}
                    equipSearch={equipSearch}
                    onEquipSearchChange={setEquipSearch}
                    filteredSerializedItems={filteredSerializedItems}
                    filteredBulkItems={filteredBulkItems}
                    canEditEquipment={false}
                    canCheckin={!!canCheckin}
                    checkinLoading={checkinLoading}
                    onEnterEquipEditMode={enterEquipEditMode}
                    onCheckinItem={handleCheckinItem}
                  />
                </div>
              </div>

              {/* ─ History section ─ */}
              <div>
                <SectionHead label="History" />
                <div className="px-6 py-4">
                  <ActivityTimeline
                    entries={allAuditLogs}
                    context="booking"
                    entityName={booking?.title}
                    hasMore={hasMoreAuditLogs}
                    loading={loadingMoreAuditLogs}
                    onLoadMore={loadMoreAuditLogs}
                  />
                </div>
              </div>

              {/* ─ Sticky check-in bar ─ */}
              {canCheckin && unreturnedCount > 0 && (
                <div
                  className="sticky bottom-0 left-0 right-0 z-10 flex items-center gap-4 px-6 py-4 border-t border-white/10"
                  style={{ backgroundColor: "var(--sidebar-bg)" }}
                >
                  <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    <Progress
                      value={checkinProgress?.percent ?? 0}
                      className="h-1.5"
                      style={
                        {
                          "--progress-bg": "rgba(255,255,255,0.12)",
                          "--progress-fill": "var(--wi-red)",
                        } as React.CSSProperties
                      }
                    />
                    <span className="text-[11px] text-white/55">
                      {checkinProgress?.returned ?? 0} of {checkinProgress?.total ?? unreturnedCount} items returned
                    </span>
                  </div>
                  <Button
                    onClick={handleCheckinAll}
                    disabled={checkinLoading}
                    className="rounded-sm text-white text-xs font-bold uppercase tracking-wider shrink-0 hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: "var(--wi-red)" }}
                  >
                    {checkinLoading ? "Checking in..." : "Check in all"}
                  </Button>
                </div>
              )}
            </>
          )}
        </SheetBody>

        {/* Footer */}
        {booking && !editMode && !equipEditMode && (
          <SheetFooter>
            <div className="flex items-center gap-2 w-full">
              {/* Left: Edit + Cancel */}
              {canEdit && (
                <Button variant="outline" size="sm" onClick={enterEditMode}>
                  Edit
                </Button>
              )}
              {canCancel && (
                <Button variant="destructive" size="sm" onClick={handleCancel} disabled={cancelling}>
                  {cancelling ? "Cancelling..." : "Cancel"}
                </Button>
              )}

              <div className="flex-1" />

              {/* Right: Convert (reservations) + Full page */}
              {canConvert && (
                <Button size="sm" variant="brand" onClick={handleConvert} disabled={converting}>
                  {converting ? "Converting..." : "Start checkout"}
                </Button>
              )}
              <Button variant="outline" size="sm" asChild>
                <Link href={detailHref}>
                  Full Details <ExternalLinkIcon className="size-3.5 ml-1" />
                </Link>
              </Button>
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
