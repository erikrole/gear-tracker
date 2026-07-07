"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { useConfirm } from "@/components/ConfirmDialog";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import EmptyState from "@/components/EmptyState";
import { OperationalLoadingState } from "@/components/OperationalLoadingState";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetDescription,
  SheetTitle,
  SheetBody,
  SheetFooter,
} from "@/components/ui/sheet";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { handleAuthRedirect, parseErrorMessage, parseJsonSafely } from "@/lib/errors";
import { getBookingCancelCopy } from "@/hooks/booking-action-copy";
import { BOOKING_CHANGE_SYNC_EVENT } from "@/hooks/use-booking-change-sync";
import { statusBadgeVariant, statusLabel } from "./booking-details/helpers";
import { toLocalDateTimeValue } from "./booking-details/helpers";
import { BookingEditForm, BookingItems } from "./booking-details";
import BookingInfoCard from "./booking-details/BookingInfoCard";
import dynamic from "next/dynamic";
import type { PickerBulkSku } from "@/components/EquipmentPicker";
const EquipmentPicker = dynamic(() => import("@/components/EquipmentPicker"), { ssr: false });
import { UserAvatar } from "@/components/UserAvatar";
import Link from "next/link";
import { ExternalLinkIcon, TriangleAlert } from "lucide-react";
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

  const [fetchError, setFetchError] = useState(false);

  const [cancelling, setCancelling] = useState(false);
  const saveBusyRef = useRef(false);
  const equipSaveBusyRef = useRef(false);
  const cancelBusyRef = useRef(false);
  const sheetBodyRef = useRef<HTMLDivElement | null>(null);
  const detailsSectionRef = useRef<HTMLDivElement | null>(null);
  const equipmentSectionRef = useRef<HTMLDivElement | null>(null);

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

  // Scroll to the equipment section when opened with that intent.
  useEffect(() => {
    if (!bookingId || loading || !booking || editMode || equipEditMode) return;
    if (initialTab !== "equipment") return;
    const section = equipmentSectionRef.current;
    if (!section) return;
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

  /* ───── Derived state ───── */

  const checkinProgress = useMemo(() => {
    if (!booking || booking.kind !== "CHECKOUT" || booking.status !== "OPEN") return null;
    const items = booking.serializedItems ?? [];
    const total = items.length;
    if (total === 0) return null;
    const returned = items.filter((i) => i.allocationStatus === "returned").length;
    return { returned, total, percent: Math.round((returned / total) * 100) };
  }, [booking]);

  /* ───── Permission flags ───── */

  const actions = booking?.allowedActions ?? [];
  const canEdit = booking && actions.includes("edit");
  const canCancel = booking && actions.includes("cancel");
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

  function mergeBooking(patch: Partial<BookingDetail>) {
    setBooking((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  async function handleSaveField(field: string, value: unknown) {
    if (!booking) return;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (booking.updatedAt) headers["If-Unmodified-Since"] = new Date(booking.updatedAt).toUTCString();
    const res = await fetchWithTimeout(`/api/bookings/${booking.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ [field]: value }),
    });
    if (handleAuthRedirect(res)) throw new DOMException("Auth redirect", "AbortError");
    if (!res.ok) {
      const json = await parseJsonSafely<ApiEnvelope<ConflictData>>(res);
      if (res.status === 409 && json?.data) setConflictError(json.data);
      throw new Error(json?.error || "Failed to save");
    }
    await fetchBooking({ silent: true });
    onUpdated?.();
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
                {booking?.title || "Loading booking"}
              </SheetTitle>
              <SheetDescription className="sr-only">
                Booking summary with timing, requester, equipment, and a link to the full booking page.
              </SheetDescription>
              {booking && (
                  <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs leading-relaxed text-muted-foreground">
                    {booking.refNumber && <span className="font-mono">{booking.refNumber}</span>}
                    {booking.refNumber && <span aria-hidden="true">/</span>}
                    <span>{booking.bookingType}</span>
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
            <OperationalLoadingState
              variant="sheet"
              title="Loading booking details"
              description="Keeping this sheet stable while the latest booking state loads."
              rows={5}
            />
          ) : fetchError ? (
            <EmptyState
              inline
              icon="wifi-off"
              title="Booking details could not load"
              description="Retry before taking action on this record."
              actionLabel="Retry booking"
              onAction={() => fetchBooking()}
            />
          ) : !booking ? (
            <EmptyState
              inline
              icon="clipboard"
              title="Booking not found"
              description="The booking may have been cancelled, archived, or moved since this sheet opened."
            />
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
                bookingKind={booking.kind === "CHECKOUT" ? "CHECKOUT" : "RESERVATION"}
              />
              <div className="flex gap-2">
                <Button loading={equipSaving} onClick={handleEquipSave}>
                  Save equipment
                </Button>
                <Button variant="outline" onClick={() => { setEquipEditMode(false); setConflictError(null); }}>
                  Cancel
                </Button>
              </div>
            </div>

          ) : (

            /* ── Summary view ── */
            <>
              {/* ─ Details section ─ */}
              <div ref={detailsSectionRef} data-booking-sheet-section="details" className="border-b border-border/40 bg-background">
                <SectionHead label="Details" />
                <div className="px-6 pb-4 pt-2 flex flex-col gap-4">
                  {conflictError?.conflicts && conflictError.conflicts.length > 0 && (
                    <Alert variant="destructive">
                      <TriangleAlert className="size-4" />
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
                  {checkinProgress && checkinProgress.returned > 0 && (
                    <div className="flex items-center gap-3 px-1">
                      <Progress value={checkinProgress.percent} className="flex-1 h-2" />
                      <span className="text-xs text-muted-foreground whitespace-nowrap font-medium">
                        {checkinProgress.returned}/{checkinProgress.total} returned
                      </span>
                    </div>
                  )}
                  <BookingInfoCard
                    booking={booking}
                    canEdit={false}
                    onSave={handleSaveField}
                    onPatch={mergeBooking}
                    bare
                  />
                </div>
              </div>

              {/* ─ Equipment section ─ */}
              <div ref={equipmentSectionRef} data-booking-sheet-section="equipment" className="bg-background">
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
                <Button variant="destructive" size="sm" onClick={handleCancel} loading={cancelling}>
                  Cancel
                </Button>
              )}

              <div className="flex-1" />

              {/* Right: Full page */}
              <Button variant="outline" size="sm" asChild>
                <Link href={detailHref}>
                  Open full booking <ExternalLinkIcon data-icon="inline-end" />
                </Link>
              </Button>
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
