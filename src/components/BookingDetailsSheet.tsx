"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { statusBadgeVariant, EQUIPMENT_ACTIONS } from "./booking-details/helpers";
import { toLocalDateTimeValue } from "./booking-details/helpers";
import {
  BookingOverview,
  BookingEditForm,
  BookingItems,
  BookingEquipmentEditor,
  BookingHistory,
  BookingActions,
} from "./booking-details";
import type {
  BookingDetail,
  AvailableAsset,
  BulkSkuOption,
  ConflictData,
  TabKey,
  HistoryFilter,
} from "./booking-details/types";

/* ───── Props ───── */

type Props = {
  bookingId: string | null;
  onClose: () => void;
  onUpdated?: () => void;
  currentUserRole?: string;
};

/* ───── Component ───── */

export default function BookingDetailsSheet({
  bookingId,
  onClose,
  onUpdated,
  currentUserRole,
}: Props) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("info");
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
  const [addingItems, setAddingItems] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerTab, setPickerTab] = useState<"serialized" | "bulk">(
    "serialized"
  );
  const [availableAssets, setAvailableAssets] = useState<AvailableAsset[]>([]);
  const [bulkSkus, setBulkSkus] = useState<BulkSkuOption[]>([]);
  const [equipSaving, setEquipSaving] = useState(false);
  const [conflictError, setConflictError] = useState<ConflictData | null>(null);
  const [optionsError, setOptionsError] = useState(false);

  // History filter
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [expandedDiffs, setExpandedDiffs] = useState<Set<string>>(new Set());

  const isAdmin = currentUserRole === "ADMIN";

  const [fetchError, setFetchError] = useState(false);

  // Action loading states (must be before early return to satisfy Rules of Hooks)
  const [extending, setExtending] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [converting, setConverting] = useState(false);
  const [checkinLoading, setCheckinLoading] = useState(false);

  /* ───── Data fetching ───── */

  const abortRef = useRef<AbortController | null>(null);

  const fetchBooking = useCallback(async (opts?: { silent?: boolean }) => {
    if (!bookingId) return;
    // Only show skeleton on initial load, not on refresh after mutations
    if (!opts?.silent) setLoading(true);
    setFetchError(false);

    // Abort any in-flight request to prevent stale data overwriting fresh
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetchWithTimeout(`/api/bookings/${bookingId}`, {
        signal: controller.signal,
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.data) setBooking(json.data);
      } else if (res.status === 401) {
        window.location.href = "/login";
        return;
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
      setTab("info");
      setEditMode(false);
      setEquipEditMode(false);
      setConflictError(null);
    }
    return () => { abortRef.current?.abort(); };
  }, [bookingId, fetchBooking]);

  /** Redirect to login on 401, return true if redirected */
  function handle401(res: Response): boolean {
    if (res.status === 401) { window.location.href = "/login"; return true; }
    return false;
  }

  const loadFormOptions = useCallback(async () => {
    try {
      setOptionsError(false);
      const res = await fetchWithTimeout("/api/form-options");
      if (handle401(res)) return;
      if (res.ok) {
        const json = await res.json();
        setAvailableAssets(json.data.availableAssets || []);
        setBulkSkus(json.data.bulkSkus || []);
      } else {
        setOptionsError(true);
      }
    } catch {
      setOptionsError(true);
      toast("Failed to load equipment options", "error");
    }
  }, [toast]);

  /* ───── Derived state ───── */

  const checkinProgress = useMemo(() => {
    if (!booking || booking.kind !== "CHECKOUT" || booking.status !== "OPEN") return null;
    const items = booking.serializedItems ?? [];
    const total = items.length;
    if (total === 0) return null;
    const returned = items.filter((i) => i.allocationStatus === "returned").length;
    return { returned, total, percent: Math.round((returned / total) * 100) };
  }, [booking]);

  const filteredAuditLogs = useMemo(() => {
    if (!booking) return [];
    const logs = booking.auditLogs ?? [];
    if (historyFilter === "all") return logs;
    if (historyFilter === "equipment") {
      return logs.filter((e) => EQUIPMENT_ACTIONS.has(e.action));
    }
    return logs.filter((e) => !EQUIPMENT_ACTIONS.has(e.action));
  }, [booking, historyFilter]);

  const pickerAssets = useMemo(() => {
    if (!booking) return [];
    const q = pickerSearch.toLowerCase();
    return availableAssets.filter((a) => {
      if (editSerializedIds.includes(a.id)) return false;
      if (!q) return true;
      return (
        a.assetTag.toLowerCase().includes(q) ||
        a.brand.toLowerCase().includes(q) ||
        a.model.toLowerCase().includes(q)
      );
    });
  }, [availableAssets, editSerializedIds, pickerSearch, booking]);

  const pickerBulkSkus = useMemo(() => {
    if (!booking) return [];
    const q = pickerSearch.toLowerCase();
    const existingSkuIds = new Set(editBulkItems.map((i) => i.bulkSkuId));
    return bulkSkus.filter((s) => {
      if (existingSkuIds.has(s.id)) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
      );
    });
  }, [bulkSkus, editBulkItems, pickerSearch, booking]);

  const returnSuggestion = useMemo(() => {
    if (!booking) return null;
    if (booking.locationMode === "SINGLE") {
      return `Return to ${booking.itemLocations[0]?.name || booking.location.name}`;
    }
    const names = booking.itemLocations.map((l) => l.name);
    return `Return to both: ${names.join(" + ")}`;
  }, [booking]);

  const resolveAssetName = useCallback(
    (assetId: string) => {
      const fromBooking = booking?.serializedItems.find(
        (i) => i.asset.id === assetId
      );
      if (fromBooking)
        return `${fromBooking.asset.assetTag} - ${fromBooking.asset.brand} ${fromBooking.asset.model}`;
      const fromAvailable = availableAssets.find((a) => a.id === assetId);
      if (fromAvailable)
        return `${fromAvailable.assetTag} - ${fromAvailable.brand} ${fromAvailable.model}`;
      return assetId;
    },
    [booking, availableAssets]
  );

  const resolveSkuName = useCallback(
    (skuId: string) => {
      const fromBooking = booking?.bulkItems.find(
        (i) => i.bulkSku.id === skuId
      );
      if (fromBooking) return fromBooking.bulkSku.name;
      const fromOptions = bulkSkus.find((s) => s.id === skuId);
      if (fromOptions) return fromOptions.name;
      return skuId;
    },
    [booking, bulkSkus]
  );

  /* ───── Permission flags ───── */

  const actions = booking?.allowedActions ?? [];
  const canEdit = booking && actions.includes("edit");
  const canCancel = booking && actions.includes("cancel");
  const canExtend = booking && actions.includes("extend");
  const canCheckin = booking && booking.kind === "CHECKOUT" && actions.includes("checkin");
  const canConvert = booking && booking.kind === "RESERVATION" && actions.includes("convert");
  const canEditEquipment = canEdit;

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
    setAddingItems(false);
    setConflictError(null);
    loadFormOptions();
  }

  async function handleRemoveSerializedItem(assetId: string) {
    const ok = await confirm({
      title: "Remove item",
      message: "Remove this item from the booking?",
      confirmLabel: "Remove",
      variant: "danger",
    });
    if (ok) {
      setEditSerializedIds((prev) => prev.filter((id) => id !== assetId));
    }
  }

  function addSerializedItem(assetId: string) {
    setEditSerializedIds((prev) =>
      prev.includes(assetId) ? prev : [...prev, assetId]
    );
  }

  function updateBulkQty(skuId: string, qty: number) {
    if (qty <= 0) {
      setEditBulkItems((prev) =>
        prev.filter((item) => item.bulkSkuId !== skuId)
      );
      return;
    }
    setEditBulkItems((prev) =>
      prev.map((item) =>
        item.bulkSkuId === skuId ? { ...item, quantity: qty } : item
      )
    );
  }

  function removeBulkItem(skuId: string) {
    setEditBulkItems((prev) =>
      prev.filter((item) => item.bulkSkuId !== skuId)
    );
  }

  function addBulkItem(skuId: string) {
    if (editBulkItems.some((i) => i.bulkSkuId === skuId)) return;
    setEditBulkItems((prev) => [...prev, { bulkSkuId: skuId, quantity: 1 }]);
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

      if (handle401(res)) return;
      if (res.ok) {
        toast("Equipment updated", "success");
        setEquipEditMode(false);
        await fetchBooking({ silent: true });
        onUpdated?.();
      } else {
        const json = await res.json().catch(() => ({}) as Record<string, unknown>);
        if (res.status === 409 && json.data) {
          setConflictError(json.data as ConflictData);
        }
        toast((json.error as string) || "Failed to save equipment changes", "error");
      }
    } catch {
      toast("Failed to save", "error");
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
      toast("No changes to save", "info");
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

      if (handle401(res)) return;
      if (res.ok) {
        toast("Booking updated", "success");
        setEditMode(false);
        await fetchBooking({ silent: true });
        onUpdated?.();
      } else {
        const json = await res.json().catch(() => ({}) as Record<string, unknown>);
        if (res.status === 409 && json.data) {
          setConflictError(json.data as ConflictData);
        }
        toast((json.error as string) || "Failed to save", "error");
      }
    } catch {
      toast("Failed to save", "error");
    }
    setSaving(false);
  }

  async function handleExtend(days: number) {
    if (!booking || extending) return;
    setExtending(true);
    const current = new Date(booking.endsAt);
    const extended = new Date(current.getTime() + days * 24 * 60 * 60 * 1000);

    try {
      const res = await fetchWithTimeout(`/api/bookings/${booking.id}/extend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endsAt: extended.toISOString() }),
      });

      if (handle401(res)) return;
      if (res.ok) {
        const newDate = extended.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        toast(`Extended to ${newDate}`, "success");
        await fetchBooking({ silent: true });
        onUpdated?.();
      } else {
        const json = await res.json().catch(() => ({}) as Record<string, unknown>);
        toast((json as Record<string, string>).error || "Failed to extend", "error");
      }
    } catch {
      toast("Failed to extend", "error");
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
      const res = await fetchWithTimeout(`/api/bookings/${booking.id}/cancel`, {
        method: "POST",
      });

      if (handle401(res)) return;
      if (res.ok) {
        toast("Booking cancelled", "success");
        await fetchBooking({ silent: true });
        onUpdated?.();
      } else {
        const json = await res.json().catch(() => ({}) as Record<string, unknown>);
        toast((json as Record<string, string>).error || "Failed to cancel", "error");
      }
    } catch {
      toast("Failed to cancel", "error");
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
      const res = await fetchWithTimeout(`/api/reservations/${booking.id}/convert`, {
        method: "POST",
      });

      if (handle401(res)) return;
      if (res.ok) {
        const json = await res.json();
        toast("Converted to checkout", "success");
        onUpdated?.();
        onClose();
        window.location.href = `/checkouts/${json.data.id}`;
      } else {
        const json = await res.json().catch(() => ({}) as Record<string, unknown>);
        toast((json as Record<string, string>).error || "Failed to convert", "error");
      }
    } catch {
      toast("Failed to convert", "error");
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
      if (handle401(res)) return;
      if (res.ok) {
        toast(`${item?.asset.assetTag ?? "Item"} checked in`, "success");
        await fetchBooking({ silent: true });
        onUpdated?.();
      } else {
        const json = await res.json().catch(() => ({}) as Record<string, unknown>);
        toast((json as Record<string, string>).error || "Failed to check in", "error");
      }
    } catch {
      toast("Failed to check in", "error");
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
      if (handle401(res)) return;
      if (res.ok) {
        toast("All items checked in", "success");
        await fetchBooking({ silent: true });
        onUpdated?.();
      } else {
        const json = await res.json().catch(() => ({}) as Record<string, unknown>);
        toast((json as Record<string, string>).error || "Failed to check in", "error");
      }
    } catch {
      toast("Failed to check in", "error");
    }
    setCheckinLoading(false);
  }

  function toggleDiff(entryId: string) {
    setExpandedDiffs((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  }

  /* ───── Render ───── */

  return (
    <Sheet open={!!bookingId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="sm:max-w-lg">
        {/* Header */}
        <SheetHeader>
          <SheetTitle>
            {booking?.refNumber && <span className="text-muted-foreground text-sm font-normal mr-2">{booking.refNumber}</span>}
            {booking?.title || "Loading..."}
          </SheetTitle>
          {booking && (
            <div className="flex gap-2 flex-wrap mt-1">
              <Badge variant={(statusBadgeVariant[booking.status] || "gray") as BadgeProps["variant"]}>
                {booking.isOverdue ? "overdue" : booking.status.toLowerCase()}
              </Badge>
              <Badge variant="gray">{booking.bookingType}</Badge>
              {booking.locationMode === "MIXED" && (
                <Badge variant="mixed">Mixed locations</Badge>
              )}
            </div>
          )}
        </SheetHeader>

        {/* Tabs */}
        <div className="px-6">
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
            <TabsList className="w-full justify-start">
              <TabsTrigger value="info">Info</TabsTrigger>
              <TabsTrigger value="equipment">
                Equipment{booking ? ` (${(booking.serializedItems?.length ?? 0) + (booking.bulkItems?.length ?? 0)})` : ""}
              </TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Body */}
        <SheetBody className="px-6 py-4">
          {loading ? (
            <div className="space-y-4 px-5 py-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-3/5" />
            </div>
          ) : fetchError ? (
            <div className="py-10 px-5 text-center space-y-3">
              <p className="text-muted-foreground">Failed to load booking details.</p>
              <Button variant="outline" size="sm" onClick={() => fetchBooking()}>Retry</Button>
            </div>
          ) : !booking ? (
            <div className="py-10 px-5 text-center text-muted-foreground">Booking not found</div>
          ) : (
            <>
              {/* Info Tab - View Mode */}
              {tab === "info" && !editMode && (
                <BookingOverview
                  booking={booking}
                  conflictError={conflictError}
                  returnSuggestion={returnSuggestion}
                  checkinProgress={checkinProgress}
                  canExtend={!!canExtend}
                  extending={extending}
                  onExtend={handleExtend}
                />
              )}

              {/* Info Tab - Edit Mode */}
              {tab === "info" && editMode && (
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
              )}

              {/* Equipment Tab - View Mode */}
              {tab === "equipment" && !equipEditMode && (
                <BookingItems
                  booking={booking}
                  equipSearch={equipSearch}
                  onEquipSearchChange={setEquipSearch}
                  filteredSerializedItems={filteredSerializedItems}
                  filteredBulkItems={filteredBulkItems}
                  canEditEquipment={!!canEditEquipment}
                  canCheckin={!!canCheckin}
                  checkinLoading={checkinLoading}
                  onEnterEquipEditMode={enterEquipEditMode}
                  onCheckinItem={handleCheckinItem}
                />
              )}

              {/* Equipment options error */}
              {tab === "equipment" && equipEditMode && optionsError && (
                <Alert variant="destructive" className="mb-3">
                  <AlertDescription className="flex items-center justify-between">
                    <span>Failed to load equipment options.</span>
                    <Button variant="outline" size="sm" onClick={loadFormOptions}>Retry</Button>
                  </AlertDescription>
                </Alert>
              )}

              {/* Equipment Tab - Edit Mode */}
              {tab === "equipment" && equipEditMode && (
                <BookingEquipmentEditor
                  conflictError={conflictError}
                  editSerializedIds={editSerializedIds}
                  editBulkItems={editBulkItems}
                  addingItems={addingItems}
                  pickerTab={pickerTab}
                  pickerSearch={pickerSearch}
                  pickerAssets={pickerAssets}
                  pickerBulkSkus={pickerBulkSkus}
                  equipSaving={equipSaving}
                  resolveAssetName={resolveAssetName}
                  resolveSkuName={resolveSkuName}
                  onRemoveSerializedItem={handleRemoveSerializedItem}
                  onAddSerializedItem={addSerializedItem}
                  onUpdateBulkQty={updateBulkQty}
                  onRemoveBulkItem={removeBulkItem}
                  onAddBulkItem={addBulkItem}
                  onSetAddingItems={setAddingItems}
                  onSetPickerTab={setPickerTab}
                  onSetPickerSearch={setPickerSearch}
                  onSave={handleEquipSave}
                  onCancel={() => { setEquipEditMode(false); setConflictError(null); }}
                />
              )}

              {/* History Tab */}
              {tab === "history" && (
                <BookingHistory
                  filteredAuditLogs={filteredAuditLogs}
                  historyFilter={historyFilter}
                  onSetHistoryFilter={setHistoryFilter}
                  isAdmin={isAdmin}
                  expandedDiffs={expandedDiffs}
                  onToggleDiff={toggleDiff}
                />
              )}
            </>
          )}
        </SheetBody>

        {/* Footer actions */}
        {booking && !editMode && !equipEditMode && (
          <SheetFooter>
            <BookingActions
              booking={booking}
              canEdit={!!canEdit}
              canCheckin={!!canCheckin}
              canConvert={!!canConvert}
              canCancel={!!canCancel}
              checkinLoading={checkinLoading}
              converting={converting}
              cancelling={cancelling}
              onEdit={enterEditMode}
              onCheckinAll={handleCheckinAll}
              onConvert={handleConvert}
              onCancel={handleCancel}
            />
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
