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
  SheetDescription,
  SheetTitle,
  SheetBody,
  SheetFooter,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { handleAuthRedirect, parseErrorMessage, parseJsonSafely } from "@/lib/errors";
import { getBookingCancelCopy } from "@/hooks/booking-action-copy";
import { BOOKING_CHANGE_SYNC_EVENT } from "@/hooks/use-booking-change-sync";
import { statusBadgeVariant, statusLabel } from "./booking-details/helpers";
import { toLocalDateTimeValue } from "./booking-details/helpers";
import {
  BookingOverview,
  BookingEditForm,
  BookingItems,
} from "./booking-details";
import {
  auditHistoryFailureMessage,
  auditHistoryRecoveryAction,
  type AuditHistoryRecoveryAction,
  normalizeAuditHistoryPage,
} from "./booking-details/audit-history";
import dynamic from "next/dynamic";
import type { PickerBulkSku } from "@/components/EquipmentPicker";
const EquipmentPicker = dynamic(() => import("@/components/EquipmentPicker"), { ssr: false });
import ActivityTimeline from "@/components/ActivityTimeline";
import { UserAvatar } from "@/components/UserAvatar";
import Link from "next/link";
import { ExternalLinkIcon } from "lucide-react";
import type {
  BookingDetail,
  BulkSkuOption,
  ConflictData,
  TabKey,
} from "./booking-details/types";

/* ───── Props ───── */

type Props = {
  bookingId: string | null;
  initialTab?: TabKey | null;
  onClose: () => void;
  onUpdated?: () => void;
};

type ApiEnvelope<T> = {
  data?: T;
  error?: string;
  nextCursor?: string | null;
  hasMore?: boolean;
};

type FormOptionsResponse = {
  data?: {
    bulkSkus?: BulkSkuOption[];
  };
};

/* ───── Section heading ───── */

function SectionHead({
  label,
  count,
  right,
}: {
  label: string;
  count?: number;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 px-6 pt-4 pb-1">
      <span className="flex flex-1 min-w-0 items-center gap-2">
        <span className="text-base font-semibold tracking-tight">{label}</span>
        {typeof count === "number" && count > 0 && (
          <Badge variant="secondary" size="sm" className="tabular-nums">
            {count}
          </Badge>
        )}
      </span>
      {right}
    </div>
  );
}

/* ───── Component ───── */

export default function BookingDetailsSheet({
  bookingId,
  initialTab,
  onClose,
  onUpdated,
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
  const [auditLoadError, setAuditLoadError] = useState<string | null>(null);
  const [auditLoadRecovery, setAuditLoadRecovery] = useState<AuditHistoryRecoveryAction>("retry");

  const [fetchError, setFetchError] = useState(false);

  const [extending, setExtending] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const saveBusyRef = useRef(false);
  const equipSaveBusyRef = useRef(false);
  const extendBusyRef = useRef(false);
  const cancelBusyRef = useRef(false);
  const auditBusyRef = useRef(false);
  const sheetBodyRef = useRef<HTMLDivElement | null>(null);
  const detailsSectionRef = useRef<HTMLDivElement | null>(null);
  const equipmentSectionRef = useRef<HTMLDivElement | null>(null);
  const historySectionRef = useRef<HTMLDivElement | null>(null);

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
        const json = await parseJsonSafely<ApiEnvelope<BookingDetail>>(res);
        if (json?.data) {
          setBooking(json.data);
          setExtraAuditLogs([]);
          setAuditLogCursor(json.data.auditLogNextCursor ?? null);
          setHasMoreAuditLogs(json.data.hasMoreAuditLogs ?? false);
          setAuditLoadError(null);
          setAuditLoadRecovery("retry");
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

  useEffect(() => {
    if (!bookingId) return;

    const refreshChangedBooking = (event: Event) => {
      const changedBookingIds = (event as CustomEvent<{ changedBookingIds?: unknown }>).detail?.changedBookingIds;
      if (!Array.isArray(changedBookingIds) || !changedBookingIds.includes(bookingId)) return;
      void fetchBooking({ silent: true });
    };

    window.addEventListener(BOOKING_CHANGE_SYNC_EVENT, refreshChangedBooking);
    return () => window.removeEventListener(BOOKING_CHANGE_SYNC_EVENT, refreshChangedBooking);
  }, [bookingId, fetchBooking]);

  useEffect(() => {
    if (!bookingId || loading || !booking || editMode || equipEditMode) return;
    const section = initialTab === "equipment"
      ? equipmentSectionRef.current
      : initialTab === "history"
        ? historySectionRef.current
        : detailsSectionRef.current;

    if (!section || initialTab === "details" || !initialTab) return;
    const frame = window.requestAnimationFrame(() => {
      const body = sheetBodyRef.current;
      if (!body) return;
      body.scrollTo({ top: section.offsetTop - body.offsetTop, behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [bookingId, booking, loading, editMode, equipEditMode, initialTab]);

  const loadFormOptions = useCallback(async () => {
    try {
      setOptionsError(false);
      const res = await fetchWithTimeout("/api/form-options");
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        const json = await parseJsonSafely<FormOptionsResponse>(res);
        setBulkSkus(json?.data?.bulkSkus ?? []);
      } else {
        setOptionsError(true);
      }
    } catch {
      setOptionsError(true);
      toast.error("Could not load equipment options. Retry before saving equipment changes.");
    }
  }, []);

  /* ───── Audit log load-more ───── */

  const showAuditHistoryFailure = useCallback((status?: number) => {
    const message = auditHistoryFailureMessage(status);
    setAuditLoadRecovery(auditHistoryRecoveryAction(status));
    setAuditLoadError(message);
    toast.error(message);
  }, []);

  const loadMoreAuditLogs = useCallback(async () => {
    if (!bookingId || !auditLogCursor || auditBusyRef.current) return;
    auditBusyRef.current = true;
    setLoadingMoreAuditLogs(true);
    setAuditLoadError(null);
    try {
      const res = await fetchWithTimeout(
        `/api/bookings/${bookingId}/audit-logs?cursor=${encodeURIComponent(auditLogCursor)}`
      );
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        const json = await parseJsonSafely<ApiEnvelope<BookingDetail["auditLogs"]>>(res);
        const page = normalizeAuditHistoryPage(json);
        if (!page) {
          showAuditHistoryFailure(res.status);
          return;
        }
        setExtraAuditLogs((prev) => [...prev, ...page.entries]);
        setAuditLogCursor(page.nextCursor);
        setHasMoreAuditLogs(page.hasMore);
      } else {
        showAuditHistoryFailure(res.status);
      }
    } catch {
      showAuditHistoryFailure();
    } finally {
      auditBusyRef.current = false;
      setLoadingMoreAuditLogs(false);
    }
  }, [bookingId, auditLogCursor, showAuditHistoryFailure]);

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
  const canEditEquipment = canEdit;

  /* ───── Filtered equipment ───── */

  const filteredSerializedItems = (booking?.serializedItems ?? []).filter((item) => {
    if (!equipSearch) return true;
    const q = equipSearch.toLowerCase();
    return (
      item.asset.assetTag.toLowerCase().includes(q) ||
      item.asset.brand.toLowerCase().includes(q) ||
      item.asset.model.toLowerCase().includes(q) ||
      item.asset.serialNumber?.toLowerCase().includes(q)
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
    if (!booking || equipSaveBusyRef.current) return;
    equipSaveBusyRef.current = true;
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
        const json = await parseJsonSafely<ApiEnvelope<ConflictData>>(res);
        if (res.status === 409 && json?.data) setConflictError(json.data);
        toast.error(json?.error || "Could not save equipment changes. Review conflicts and try again.");
      }
    } catch {
      toast.error("Could not reach the server. Equipment changes were not saved.");
    } finally {
      equipSaveBusyRef.current = false;
      setEquipSaving(false);
    }
  }

  async function handleSave() {
    if (!booking || saveBusyRef.current) return;
    saveBusyRef.current = true;
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
      saveBusyRef.current = false;
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
        const json = await parseJsonSafely<ApiEnvelope<ConflictData>>(res);
        if (res.status === 409 && json?.data) setConflictError(json.data);
        toast.error(json?.error || "Could not save booking changes. Review conflicts and try again.");
      }
    } catch {
      toast.error("Could not reach the server. Booking changes were not saved.");
    } finally {
      saveBusyRef.current = false;
      setSaving(false);
    }
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
      const json = await parseJsonSafely<ApiEnvelope<ConflictData>>(res);
      if (res.status === 409 && json?.data) setConflictError(json.data);
      throw new Error(json?.error || "Failed to save date");
    }
    await fetchBooking({ silent: true });
    onUpdated?.();
  }

  async function handleExtendTo(endsAt: string) {
    if (!booking || extendBusyRef.current) return;
    extendBusyRef.current = true;
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
        const msg = await parseErrorMessage(res, "Could not extend the booking. Review conflicts and try again.");
        toast.error(msg);
      }
    } catch {
      toast.error("Could not reach the server. The booking was not extended.");
    } finally {
      extendBusyRef.current = false;
      setExtending(false);
    }
  }

  async function handleCancel() {
    if (!booking || cancelBusyRef.current) return;
    const typeLabel = booking.kind === "RESERVATION" ? "reservation" : "checkout";
    const copy = getBookingCancelCopy(booking.kind, booking.title);
    const ok = await confirm({
      title: copy.title,
      message: copy.message,
      confirmLabel: copy.confirmLabel,
      variant: "danger",
    });
    if (!ok) return;

    cancelBusyRef.current = true;
    setCancelling(true);
    try {
      const res = await fetchWithTimeout(`/api/bookings/${booking.id}/cancel`, { method: "POST" });
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        toast.success(copy.success);
        await fetchBooking({ silent: true });
        onUpdated?.();
      } else {
        const msg = await parseErrorMessage(res, `Could not cancel the ${typeLabel}. Refresh and try again.`);
        toast.error(msg);
      }
    } catch {
      toast.error(`Could not reach the server. The ${typeLabel} was not cancelled.`);
    } finally {
      cancelBusyRef.current = false;
      setCancelling(false);
    }
  }

  /* ───── Render ───── */

  const detailHref = booking
    ? booking.kind === "CHECKOUT"
      ? `/checkouts/${booking.id}`
      : `/reservations/${booking.id}`
    : "#";

  return (
    <Sheet open={!!bookingId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="flex flex-col sm:max-w-lg">

        {/* Header */}
        <SheetHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              {booking && (
                <UserAvatar
                  name={booking.requester?.name ?? "Unknown"}
                  avatarUrl={booking.requester?.avatarUrl}
                  size="md"
                  className="mt-0.5 shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
              <SheetTitle className="truncate">
                {booking?.title || "Loading..."}
              </SheetTitle>
              <SheetDescription className="sr-only">
                Booking preview with timing, requester, equipment, history, and a link to the full booking page.
              </SheetDescription>
              {booking && (
                  <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs leading-relaxed text-muted-foreground">
                    {booking.refNumber && <span className="font-mono">{booking.refNumber}</span>}
                    {booking.refNumber && <span aria-hidden="true">/</span>}
                    <span>{booking.bookingType}</span>
                    {booking.location?.name && (
                      <>
                        <span aria-hidden="true">/</span>
                        <span>{booking.location.name}</span>
                      </>
                    )}
                  </p>
                )}
              </div>
            </div>
            {booking && (
              <Badge
                variant={(booking.isOverdue ? "red" : statusBadgeVariant(booking.status, booking.kind)) as BadgeProps["variant"]}
                className="shrink-0 mt-0.5"
              >
                {booking.isOverdue ? "Overdue" : statusLabel(booking.status, booking.kind)}
              </Badge>
            )}
          </div>
        </SheetHeader>

        {/* Body — single scrollable column */}
        <SheetBody ref={sheetBodyRef} className="relative flex flex-col bg-muted/20 px-0 py-0">
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
              <p className="text-muted-foreground">Booking details could not load. Retry before taking action on this record.</p>
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
                    <span>Equipment options could not load. Retry before saving equipment changes.</span>
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
                excludeBookingId={booking.id}
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
              <div ref={detailsSectionRef} data-booking-sheet-section="details" className="border-b border-border/40 bg-background">
                <SectionHead label="Details" />
                <div className="px-6 pb-4 pt-2">
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
              <div ref={equipmentSectionRef} data-booking-sheet-section="equipment" className="border-b border-border/40 bg-background">
                <SectionHead
                  label="Equipment"
                  count={totalEquipItems}
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

                <div className="px-6 pb-4 pt-2">
                  <BookingItems
                    booking={booking}
                    equipSearch={equipSearch}
                    onEquipSearchChange={setEquipSearch}
                    filteredSerializedItems={filteredSerializedItems}
                    filteredBulkItems={filteredBulkItems}
                    canEditEquipment={false}
                    canCheckin={false}
                    checkinLoading={false}
                    onEnterEquipEditMode={enterEquipEditMode}
                  />
                </div>
              </div>

              {/* ─ History section ─ */}
              <div ref={historySectionRef} data-booking-sheet-section="history" className="bg-background">
                <SectionHead label="History" count={allAuditLogs.length} />
                <div className="px-6 pb-4 pt-2">
                  {auditLoadError && (
                    <Alert variant="destructive" className="mb-3">
                      <AlertDescription className="flex items-start justify-between gap-3">
                        <span>{auditLoadError}</span>
                        {(auditLoadRecovery === "refresh" || (hasMoreAuditLogs && auditLogCursor)) && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={loadingMoreAuditLogs}
                            onClick={
                              auditLoadRecovery === "refresh"
                                ? () => fetchBooking({ silent: true })
                                : loadMoreAuditLogs
                            }
                          >
                            {loadingMoreAuditLogs
                              ? "Retrying..."
                              : auditLoadRecovery === "refresh"
                                ? "Refresh"
                                : "Retry"}
                          </Button>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}
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
            </>
          )}
        </SheetBody>

        {/* Footer */}
        {booking && !editMode && !equipEditMode && (
          <SheetFooter className="bg-background">
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

              {/* Right: Full page */}
              <Button variant="outline" size="sm" asChild>
                <Link href={detailHref}>
                  Open full booking <ExternalLinkIcon className="size-3.5 ml-1" />
                </Link>
              </Button>
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
