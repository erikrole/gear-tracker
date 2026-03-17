"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import { statusBadge, EQUIPMENT_ACTIONS } from "./booking-details/helpers";
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

  const fetchBooking = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    setFetchError(false);
    try {
      const res = await fetch(`/api/bookings/${bookingId}`);
      if (res.ok) {
        const json = await res.json();
        if (json?.data) setBooking(json.data);
      } else {
        setFetchError(true);
      }
    } catch {
      setFetchError(true);
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
  }, [bookingId, fetchBooking]);

  const loadFormOptions = useCallback(async () => {
    try {
      const res = await fetch("/api/form-options");
      if (res.ok) {
        const json = await res.json();
        setAvailableAssets(json.data.availableAssets || []);
        setBulkSkus(json.data.bulkSkus || []);
      }
    } catch { toast("Failed to load equipment options", "error"); }
  }, []);

  /* ───── Derived state ───── */

  const checkinProgress = useMemo(() => {
    if (!booking || booking.kind !== "CHECKOUT" || booking.status !== "OPEN") return null;
    const total = booking.serializedItems.length;
    if (total === 0) return null;
    const returned = booking.serializedItems.filter((i) => i.allocationStatus === "returned").length;
    return { returned, total, percent: Math.round((returned / total) * 100) };
  }, [booking]);

  const filteredAuditLogs = useMemo(() => {
    if (!booking) return [];
    if (historyFilter === "all") return booking.auditLogs;
    if (historyFilter === "equipment") {
      return booking.auditLogs.filter((e) => EQUIPMENT_ACTIONS.has(e.action));
    }
    return booking.auditLogs.filter((e) => !EQUIPMENT_ACTIONS.has(e.action));
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

  const filteredSerializedItems = booking?.serializedItems.filter((item) => {
    if (!equipSearch) return true;
    const q = equipSearch.toLowerCase();
    return (
      item.asset.assetTag.toLowerCase().includes(q) ||
      item.asset.brand.toLowerCase().includes(q) ||
      item.asset.model.toLowerCase().includes(q) ||
      item.asset.serialNumber.toLowerCase().includes(q)
    );
  }) ?? [];

  const filteredBulkItems = booking?.bulkItems.filter((item) => {
    if (!equipSearch) return true;
    return item.bulkSku.name.toLowerCase().includes(equipSearch.toLowerCase());
  }) ?? [];

  /* ───── Handlers ───── */

  if (!bookingId) return null;

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
    setEditSerializedIds(booking.serializedItems.map((i) => i.asset.id));
    setEditBulkItems(
      booking.bulkItems.map((i) => ({
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
    if (!booking) return;
    setEquipSaving(true);
    setConflictError(null);

    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serializedAssetIds: editSerializedIds,
          bulkItems: editBulkItems,
        }),
      });

      if (res.ok) {
        toast("Equipment updated", "success");
        setEquipEditMode(false);
        await fetchBooking();
        onUpdated?.();
      } else {
        const json = await res.json();
        if (res.status === 409 && json.data) {
          setConflictError(json.data as ConflictData);
        }
        toast(json.error || "Failed to save equipment changes", "error");
      }
    } catch {
      toast("Failed to save", "error");
    }
    setEquipSaving(false);
  }

  async function handleSave() {
    if (!booking) return;
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

    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast("Booking updated", "success");
        setEditMode(false);
        await fetchBooking();
        onUpdated?.();
      } else {
        const json = await res.json();
        if (res.status === 409 && json.data) {
          setConflictError(json.data as ConflictData);
        }
        toast(json.error || "Failed to save", "error");
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
      const res = await fetch(`/api/bookings/${booking.id}/extend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endsAt: extended.toISOString() }),
      });

      if (res.ok) {
        toast(`Extended by ${days} day${days > 1 ? "s" : ""}`, "success");
        await fetchBooking();
        onUpdated?.();
      } else {
        const json = await res.json();
        toast(json.error || "Failed to extend", "error");
      }
    } catch {
      toast("Failed to extend", "error");
    }
    setExtending(false);
  }

  async function handleCancel() {
    if (!booking || cancelling) return;
    const ok = await confirm({
      title: "Cancel booking",
      message: `Cancel "${booking.title}"? This cannot be undone.`,
      confirmLabel: "Cancel booking",
      variant: "danger",
    });
    if (!ok) return;

    setCancelling(true);
    try {
      const res = await fetch(`/api/bookings/${booking.id}/cancel`, {
        method: "POST",
      });

      if (res.ok) {
        toast("Booking cancelled", "success");
        await fetchBooking();
        onUpdated?.();
      } else {
        const json = await res.json();
        toast(json.error || "Failed to cancel", "error");
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
      const res = await fetch(`/api/reservations/${booking.id}/convert`, {
        method: "POST",
      });

      if (res.ok) {
        const json = await res.json();
        toast("Converted to checkout", "success");
        onUpdated?.();
        onClose();
        window.location.href = `/checkouts/${json.data.id}`;
      } else {
        const json = await res.json();
        toast(json.error || "Failed to convert", "error");
      }
    } catch {
      toast("Failed to convert", "error");
    }
    setConverting(false);
  }

  async function handleCheckinItem(assetId: string) {
    if (!booking) return;
    setCheckinLoading(true);
    try {
      const res = await fetch(`/api/checkouts/${booking.id}/checkin-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetIds: [assetId] }),
      });
      if (res.ok) {
        toast("Item checked in", "success");
        await fetchBooking();
        onUpdated?.();
      } else {
        const json = await res.json();
        toast(json.error || "Failed to check in", "error");
      }
    } catch {
      toast("Failed to check in", "error");
    }
    setCheckinLoading(false);
  }

  async function handleCheckinAll() {
    if (!booking) return;
    const activeItems = booking.serializedItems.filter((i) => i.allocationStatus !== "returned");
    if (activeItems.length === 0) return;
    const ok = await confirm({
      title: "Check in all items",
      message: `Check in all ${activeItems.length} remaining item(s)?`,
      confirmLabel: "Check in all",
    });
    if (!ok) return;

    setCheckinLoading(true);
    try {
      const res = await fetch(`/api/checkouts/${booking.id}/checkin-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetIds: activeItems.map((i) => i.asset.id) }),
      });
      if (res.ok) {
        toast("All items checked in", "success");
        await fetchBooking();
        onUpdated?.();
      } else {
        const json = await res.json();
        toast(json.error || "Failed to check in", "error");
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
    <>
      {/* Overlay */}
      <div className="sheet-overlay" onClick={onClose} />

      {/* Panel */}
      <div className="sheet-panel">
        {/* Header */}
        <div className="sheet-header">
          <div>
            <h2 className="sheet-title">
              {booking?.refNumber && <span className="ref-number">{booking.refNumber}</span>}
              {booking?.title || "Loading..."}
            </h2>
            {booking && (
              <div className="badge-row">
                <span className={`badge ${statusBadge[booking.status] || "badge-gray"}`}>
                  {booking.isOverdue ? "overdue" : booking.status.toLowerCase()}
                </span>
                <span className="badge badge-gray">{booking.bookingType}</span>
                {booking.locationMode === "MIXED" && (
                  <span className="badge badge-mixed">Mixed locations</span>
                )}
              </div>
            )}
          </div>
          <button className="sheet-close" onClick={onClose}>&times;</button>
        </div>

        {/* Tabs */}
        <div className="sheet-tabs">
          {(["info", "equipment", "history"] as TabKey[]).map((t) => (
            <button
              key={t}
              className={`sheet-tab ${tab === t ? "active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t === "info" ? "Info" : t === "equipment" ? `Equipment${booking ? ` (${booking.serializedItems.length + booking.bulkItems.length})` : ""}` : "History"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="sheet-body">
          {loading ? (
            <div className="loading-spinner"><div className="spinner" /></div>
          ) : fetchError ? (
            <div className="empty-state">Failed to load booking details.</div>
          ) : !booking ? (
            <div className="empty-state">Booking not found</div>
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
        </div>

        {/* Footer actions */}
        {booking && !editMode && !equipEditMode && (
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
        )}
      </div>
    </>
  );
}
