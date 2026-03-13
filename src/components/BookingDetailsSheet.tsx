"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import DataList from "@/components/DataList";
import { formatDateTime } from "@/lib/format";

/* ───── Types ───── */

type SerializedItem = {
  id: string;
  allocationStatus?: string;
  asset: {
    id: string;
    assetTag: string;
    brand: string;
    model: string;
    serialNumber: string;
    type: string;
    location?: { id: string; name: string };
  };
};

type BulkItem = {
  id: string;
  plannedQuantity: number;
  checkedOutQuantity: number | null;
  checkedInQuantity: number | null;
  bulkSku: { id: string; name: string; category: string; unit: string };
};

type AuditEntry = {
  id: string;
  action: string;
  createdAt: string;
  beforeJson: Record<string, unknown> | null;
  afterJson: Record<string, unknown> | null;
  actor: { id: string; name: string };
};

type LocationInfo = { id: string; name: string };

type BookingDetail = {
  id: string;
  kind: "RESERVATION" | "CHECKOUT";
  title: string;
  status: string;
  startsAt: string;
  endsAt: string;
  notes: string | null;
  createdAt: string;
  location: LocationInfo;
  requester: { id: string; name: string; email: string };
  creator?: { id: string; name: string; email: string };
  serializedItems: SerializedItem[];
  bulkItems: BulkItem[];
  isOverdue: boolean;
  isActive: boolean;
  bookingType: string;
  auditLogs: AuditEntry[];
  itemLocations: LocationInfo[];
  locationMode: "SINGLE" | "MIXED";
  allowedActions?: string[];
};

type AvailableAsset = {
  id: string;
  assetTag: string;
  brand: string;
  model: string;
  locationId: string;
};

type BulkSkuOption = {
  id: string;
  name: string;
  category: string;
  unit: string;
  locationId: string;
};

type ConflictData = {
  conflicts?: Array<{
    assetId: string;
    conflictingBookingId: string;
    conflictingBookingTitle?: string;
    startsAt: string;
    endsAt: string;
  }>;
};

type TabKey = "info" | "equipment" | "history";
type HistoryFilter = "all" | "booking" | "equipment";

type Props = {
  bookingId: string | null;
  onClose: () => void;
  onUpdated?: () => void;
  currentUserRole?: string;
};

/* ───── Helpers ───── */

function formatRelative(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const hours = Math.floor(diffMs / 3600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

function toLocalDateTimeValue(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  const local = new Date(date.getTime() - offsetMs);
  return local.toISOString().slice(0, 16);
}

const statusBadge: Record<string, string> = {
  DRAFT: "badge-gray",
  BOOKED: "badge-blue",
  OPEN: "badge-green",
  COMPLETED: "badge-purple",
  CANCELLED: "badge-red",
};

const EQUIPMENT_ACTIONS = new Set([
  "booking.items_added",
  "booking.items_removed",
  "booking.items_qty_changed",
]);

const actionLabels: Record<string, string> = {
  created: "Created",
  updated: "Updated",
  extended: "Extended",
  cancelled: "Cancelled",
  checkin_completed: "Check-in completed",
  cancelled_by_checkout_conversion: "Converted to checkout",
  "booking.items_added": "Items added",
  "booking.items_removed": "Items removed",
  "booking.items_qty_changed": "Item quantities changed",
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

  const fetchBooking = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}`);
      if (res.ok) {
        const json = await res.json();
        if (json?.data) setBooking(json.data);
      }
    } catch { /* network */ }
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

  // Load available assets and bulk SKUs for equipment picker
  const loadFormOptions = useCallback(async () => {
    try {
      const res = await fetch("/api/form-options");
      if (res.ok) {
        const json = await res.json();
        setAvailableAssets(json.data.availableAssets || []);
        setBulkSkus(json.data.bulkSkus || []);
      }
    } catch { /* network */ }
  }, []);

  // Check-in state (must be before early return to satisfy Rules of Hooks)
  const [checkinLoading, setCheckinLoading] = useState(false);

  const checkinProgress = useMemo(() => {
    if (!booking || booking.kind !== "CHECKOUT" || booking.status !== "OPEN") return null;
    const total = booking.serializedItems.length;
    if (total === 0) return null;
    const returned = booking.serializedItems.filter((i) => i.allocationStatus === "returned").length;
    return { returned, total, percent: Math.round((returned / total) * 100) };
  }, [booking]);

  // Filter audit entries for history tab
  const filteredAuditLogs = useMemo(() => {
    if (!booking) return [];
    if (historyFilter === "all") return booking.auditLogs;
    if (historyFilter === "equipment") {
      return booking.auditLogs.filter((e) => EQUIPMENT_ACTIONS.has(e.action));
    }
    // "booking" = everything except equipment-only actions
    return booking.auditLogs.filter((e) => !EQUIPMENT_ACTIONS.has(e.action));
  }, [booking, historyFilter]);

  // Equipment picker filtering
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

  // Build return suggestion text
  const returnSuggestion = useMemo(() => {
    if (!booking) return null;
    if (booking.locationMode === "SINGLE") {
      return `Return to ${booking.itemLocations[0]?.name || booking.location.name}`;
    }
    const names = booking.itemLocations.map((l) => l.name);
    return `Return to both: ${names.join(" + ")}`;
  }, [booking]);

  // Resolve names for equipment editing display
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

  function removeSerializedItem(assetId: string) {
    setEditSerializedIds((prev) => prev.filter((id) => id !== assetId));
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
    if (!booking) return;
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
  }

  async function handleCancel() {
    if (!booking) return;
    const ok = await confirm({
      title: "Cancel booking",
      message: `Cancel "${booking.title}"? This cannot be undone.`,
      confirmLabel: "Cancel booking",
      variant: "danger",
    });
    if (!ok) return;

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
  }

  async function handleConvert() {
    if (!booking) return;
    const ok = await confirm({
      title: "Convert to checkout",
      message: "Convert this reservation to a checkout? The reservation will be cancelled and a new checkout created.",
      confirmLabel: "Start checkout",
    });
    if (!ok) return;

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

  // Use server-provided allowedActions for both checkouts and reservations
  const actions = booking?.allowedActions ?? [];
  const canEdit = booking && actions.includes("edit");
  const canCancel = booking && actions.includes("cancel");
  const canExtend = booking && actions.includes("extend");
  const canCheckin = booking && booking.kind === "CHECKOUT" && actions.includes("checkin");
  const canOpen = booking && booking.kind === "CHECKOUT" && actions.includes("open");
  const canConvert = booking && booking.kind === "RESERVATION" && actions.includes("convert");
  const canEditEquipment = canEdit;

  const filteredSerializedItems = booking?.serializedItems.filter((item) => {
    if (!equipSearch) return true;
    const q = equipSearch.toLowerCase();
    return (
      item.asset.assetTag.toLowerCase().includes(q) ||
      item.asset.brand.toLowerCase().includes(q) ||
      item.asset.model.toLowerCase().includes(q) ||
      item.asset.serialNumber.toLowerCase().includes(q)
    );
  });

  const filteredBulkItems = booking?.bulkItems.filter((item) => {
    if (!equipSearch) return true;
    return item.bulkSku.name.toLowerCase().includes(equipSearch.toLowerCase());
  });

  function toggleDiff(entryId: string) {
    setExpandedDiffs((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  }

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
          ) : !booking ? (
            <div className="empty-state">Booking not found</div>
          ) : (
            <>
              {/* ── Info Tab ── */}
              {tab === "info" && !editMode && (
                <>
                  {/* Conflict error banner */}
                  {conflictError?.conflicts && conflictError.conflicts.length > 0 && (
                    <div className="sheet-section sheet-section-no-pb">
                      <div className="conflict-error">
                        <strong>Scheduling conflict</strong>
                        {conflictError.conflicts.map((c, i) => (
                          <div key={i}>
                            {c.conflictingBookingTitle ? `"${c.conflictingBookingTitle}"` : "Another booking"}{" "}
                            ({formatDateTime(c.startsAt)} {"\u2013"} {formatDateTime(c.endsAt)})
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="sheet-section">
                    <DataList
                      items={[
                        { label: "Title", value: booking.title },
                        { label: "Type", value: booking.bookingType },
                        { label: "Status", value: (
                          <span className={`badge ${booking.isOverdue ? "badge-red" : (statusBadge[booking.status] || "badge-gray")}`}>
                            {booking.isOverdue ? "overdue" : booking.status.toLowerCase()}
                          </span>
                        )},
                        { label: "Location", value: booking.location?.name ?? "\u2014" },
                        { label: "Start", value: formatDateTime(booking.startsAt) },
                        { label: "Due", value: formatDateTime(booking.endsAt) },
                        { label: "Requester", value: `${booking.requester?.name ?? "Unknown"} (${booking.requester?.email ?? ""})` },
                        ...(booking.notes ? [{ label: "Notes", value: booking.notes }] : []),
                      ]}
                    />
                  </div>

                  {/* Return suggestion (C) */}
                  {returnSuggestion && booking.isActive && (
                    <div className="sheet-section sheet-section-no-pt">
                      <div className="return-suggestion">
                        <span className="return-icon">{"\u21b5"}</span>
                        {returnSuggestion}
                      </div>
                    </div>
                  )}

                  {/* Partial check-in progress */}
                  {checkinProgress && checkinProgress.returned > 0 && (
                    <div className="sheet-section">
                      <div className="sheet-section-title">Check-in progress</div>
                      <div className="progress-row">
                        <div className="progress-track">
                          <div
                            className="progress-fill"
                            style={{
                              width: `${checkinProgress.percent}%`,
                              background: checkinProgress.percent === 100 ? "#22c55e" : "#3b82f6",
                            }}
                          />
                        </div>
                        <span className="progress-label">
                          {checkinProgress.returned}/{checkinProgress.total} returned
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Quick actions */}
                  {canExtend && (
                    <div className="sheet-section">
                      <div className="sheet-section-title">Extend due date</div>
                      <div className="extend-buttons">
                        <button className="btn" onClick={() => handleExtend(1)}>+1 day</button>
                        <button className="btn" onClick={() => handleExtend(3)}>+3 days</button>
                        <button className="btn" onClick={() => handleExtend(7)}>+1 week</button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── Info Tab - Edit Mode ── */}
              {tab === "info" && editMode && (
                <div className="sheet-section">
                  <div className="sheet-field">
                    <label>Title</label>
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                    />
                  </div>

                  <div className="sheet-field-row">
                    {booking.kind === "RESERVATION" && (
                      <div className="sheet-field">
                        <label>Start</label>
                        <input
                          type="datetime-local"
                          step={900}
                          value={editStartsAt}
                          onChange={(e) => setEditStartsAt(e.target.value)}
                        />
                      </div>
                    )}
                    <div className="sheet-field">
                      <label>{booking.kind === "RESERVATION" ? "End" : "Due date"}</label>
                      <input
                        type="datetime-local"
                        step={900}
                        value={editEndsAt}
                        onChange={(e) => setEditEndsAt(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="sheet-field">
                    <label>Notes</label>
                    <textarea
                      rows={3}
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                    />
                  </div>

                  <div className="action-row-mt">
                    <button
                      className="btn btn-primary"
                      disabled={saving}
                      onClick={handleSave}
                    >
                      {saving ? "Saving..." : "Save changes"}
                    </button>
                    <button className="btn" onClick={() => setEditMode(false)}>Cancel</button>
                  </div>
                </div>
              )}

              {/* ── Equipment Tab - View Mode ── */}
              {tab === "equipment" && !equipEditMode && (
                <>
                  <div className="sheet-section sheet-equip-bar">
                    <input
                      className="picker-search"
                      placeholder="Search equipment..."
                      value={equipSearch}
                      onChange={(e) => setEquipSearch(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    {canEditEquipment && (
                      <button className="btn btn-sm" onClick={enterEquipEditMode}>
                        Edit
                      </button>
                    )}
                    {!canEditEquipment && booking.kind === "CHECKOUT" && (
                      <span className="text-hint">
                        View only
                      </span>
                    )}
                  </div>

                  {filteredSerializedItems && filteredSerializedItems.length > 0 && (
                    <div className="sheet-section">
                      <div className="sheet-section-title">Serialized Items</div>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Item</th>
                            <th>Brand/Model</th>
                            <th>Serial</th>
                            {canCheckin && <th className="col-status">Status</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredSerializedItems.map((item) => (
                            <tr key={item.id} className={item.allocationStatus === "returned" ? "returned-row" : undefined}>
                              <td className="cell-bold">
                                <Link href={`/items/${item.asset.id}`} className="row-link">{item.asset.assetTag}</Link>
                              </td>
                              <td>{item.asset.brand} {item.asset.model}</td>
                              <td className="cell-mono">{item.asset.serialNumber}</td>
                              {canCheckin && (
                                <td>
                                  {item.allocationStatus === "returned" ? (
                                    <span className="badge badge-purple badge-purple-sm">returned</span>
                                  ) : (
                                    <button
                                      className="btn btn-sm btn-return"
                                      disabled={checkinLoading}
                                      onClick={(e) => { e.stopPropagation(); handleCheckinItem(item.asset.id); }}
                                    >
                                      Return
                                    </button>
                                  )}
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {filteredBulkItems && filteredBulkItems.length > 0 && (
                    <div className="sheet-section">
                      <div className="sheet-section-title">Bulk Items</div>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Item</th>
                            <th>Category</th>
                            <th>Qty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredBulkItems.map((item) => (
                            <tr key={item.id}>
                              <td className="cell-bold">{item.bulkSku.name}</td>
                              <td>{item.bulkSku.category}</td>
                              <td>{item.plannedQuantity} {item.bulkSku.unit}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {(!filteredSerializedItems?.length && !filteredBulkItems?.length) && (
                    <div className="empty-state">
                      {equipSearch ? "No items match your search" : "No equipment in this booking"}
                    </div>
                  )}
                </>
              )}

              {/* ── Equipment Tab - Edit Mode ── */}
              {tab === "equipment" && equipEditMode && (
                <>
                  {/* Conflict error */}
                  {conflictError?.conflicts && conflictError.conflicts.length > 0 && (
                    <div className="sheet-section sheet-section-no-pb">
                      <div className="conflict-error">
                        <strong>Scheduling conflict</strong>
                        {conflictError.conflicts.map((c, i) => (
                          <div key={i}>
                            {c.conflictingBookingTitle ? `"${c.conflictingBookingTitle}"` : "Another booking"}{" "}
                            ({formatDateTime(c.startsAt)} {"\u2013"} {formatDateTime(c.endsAt)})
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Current serialized items */}
                  {editSerializedIds.length > 0 && (
                    <div className="sheet-section">
                      <div className="sheet-section-title">
                        Serialized Items ({editSerializedIds.length})
                      </div>
                      {editSerializedIds.map((assetId) => (
                        <div
                          key={assetId}
                          className="equip-edit-row"
                        >
                          <span className="equip-edit-name">
                            {resolveAssetName(assetId)}
                          </span>
                          <button
                            className="btn btn-sm btn-danger-outline"
                            onClick={async () => {
                              const ok = await confirm({
                                title: "Remove item",
                                message: "Remove this item from the booking?",
                                confirmLabel: "Remove",
                                variant: "danger",
                              });
                              if (ok) removeSerializedItem(assetId);
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Current bulk items with qty steppers */}
                  {editBulkItems.length > 0 && (
                    <div className="sheet-section">
                      <div className="sheet-section-title">
                        Bulk Items ({editBulkItems.length})
                      </div>
                      {editBulkItems.map((item) => (
                        <div
                          key={item.bulkSkuId}
                          className="equip-edit-row"
                        >
                          <span className="equip-edit-name-flex">
                            {resolveSkuName(item.bulkSkuId)}
                          </span>
                          <div className="qty-stepper">
                            <button onClick={() => updateBulkQty(item.bulkSkuId, item.quantity - 1)}>
                              &minus;
                            </button>
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) => updateBulkQty(item.bulkSkuId, parseInt(e.target.value) || 1)}
                            />
                            <button onClick={() => updateBulkQty(item.bulkSkuId, item.quantity + 1)}>
                              +
                            </button>
                          </div>
                          <button
                            className="btn btn-sm btn-danger-outline"
                            onClick={() => removeBulkItem(item.bulkSkuId)}
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add items picker */}
                  <div className="sheet-section">
                    {!addingItems ? (
                      <button
                        className="btn btn-full"
                        onClick={() => { setAddingItems(true); setPickerSearch(""); }}
                      >
                        + Add items
                      </button>
                    ) : (
                      <div>
                        <div className="picker-tabs">
                          <button
                            className={`filter-chip ${pickerTab === "serialized" ? "active" : ""}`}
                            onClick={() => setPickerTab("serialized")}
                          >
                            Assets
                          </button>
                          <button
                            className={`filter-chip ${pickerTab === "bulk" ? "active" : ""}`}
                            onClick={() => setPickerTab("bulk")}
                          >
                            Bulk items
                          </button>
                        </div>
                        <input
                          placeholder={pickerTab === "serialized" ? "Search by tag, brand, model..." : "Search bulk items..."}
                          value={pickerSearch}
                          onChange={(e) => setPickerSearch(e.target.value)}
                          className="picker-search"
                          autoFocus
                        />
                        <div className="equip-picker-list">
                          {pickerTab === "serialized" ? (
                            pickerAssets.length === 0 ? (
                              <div className="empty-message">
                                {pickerSearch ? "No matching assets" : "No available assets"}
                              </div>
                            ) : (
                              pickerAssets.slice(0, 50).map((asset) => (
                                <div
                                  key={asset.id}
                                  className="equip-picker-item"
                                  onClick={() => addSerializedItem(asset.id)}
                                >
                                  <div>
                                    <div className="picker-item-name">{asset.assetTag}</div>
                                    <div className="equip-picker-meta">{asset.brand} {asset.model}</div>
                                  </div>
                                </div>
                              ))
                            )
                          ) : (
                            pickerBulkSkus.length === 0 ? (
                              <div className="empty-message">
                                {pickerSearch ? "No matching bulk items" : "No available bulk items"}
                              </div>
                            ) : (
                              pickerBulkSkus.slice(0, 50).map((sku) => (
                                <div
                                  key={sku.id}
                                  className="equip-picker-item"
                                  onClick={() => addBulkItem(sku.id)}
                                >
                                  <div>
                                    <div className="picker-item-name">{sku.name}</div>
                                    <div className="equip-picker-meta">{sku.category} {"\u00b7"} {sku.unit}</div>
                                  </div>
                                </div>
                              ))
                            )
                          )}
                        </div>
                        <button
                          className="btn btn-sm btn-mt"
                          onClick={() => setAddingItems(false)}
                        >
                          Done adding
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Save / Cancel equip edit */}
                  <div className="sheet-section">
                    <div className="action-row">
                      <button
                        className="btn btn-primary"
                        disabled={equipSaving}
                        onClick={handleEquipSave}
                      >
                        {equipSaving ? "Saving..." : "Save equipment"}
                      </button>
                      <button
                        className="btn"
                        onClick={() => { setEquipEditMode(false); setConflictError(null); }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* ── History Tab ── */}
              {tab === "history" && (
                <div className="sheet-section">
                  {/* Filter chips (D) */}
                  <div className="filter-chips">
                    {([["all", "All"], ["booking", "Booking changes"], ["equipment", "Equipment changes"]] as [HistoryFilter, string][]).map(([key, label]) => (
                      <button
                        key={key}
                        className={`filter-chip ${historyFilter === key ? "active" : ""}`}
                        onClick={() => setHistoryFilter(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {filteredAuditLogs.length === 0 ? (
                    <div className="empty-state">
                      {historyFilter === "all" ? "No history yet" : "No matching history entries"}
                    </div>
                  ) : (
                    filteredAuditLogs.map((entry) => (
                      <div className="timeline-item" key={entry.id}>
                        <div className={`timeline-dot action-${entry.action}`} />
                        <div className="timeline-content">
                          <div className="timeline-action">
                            {actionLabels[entry.action] || entry.action}
                          </div>
                          <div className="timeline-meta">
                            {entry.actor.name} {"\u00b7"} {formatRelative(entry.createdAt)}
                          </div>

                          {/* Extended detail */}
                          {entry.action === "extended" && entry.afterJson && typeof entry.afterJson.endsAt === "string" && (
                            <div className="timeline-detail">
                              Extended to {formatDateTime(entry.afterJson.endsAt as string)}
                            </div>
                          )}

                          {/* Updated fields */}
                          {entry.action === "updated" && entry.afterJson && (
                            <div className="timeline-detail">
                              {Object.keys(entry.afterJson).filter((k) => k !== "serializedAssetIds" && k !== "bulkItems").map((k) => (
                                <span key={k} className="field-tag">{k}</span>
                              ))}
                            </div>
                          )}

                          {/* Equipment change details */}
                          {EQUIPMENT_ACTIONS.has(entry.action) && (
                            <div className="timeline-detail">
                              {entry.action === "booking.items_added" && entry.afterJson && (
                                <span>
                                  {Array.isArray(entry.afterJson.serializedAssetIds)
                                    ? `${(entry.afterJson.serializedAssetIds as string[]).length} serialized item(s) `
                                    : ""}
                                  {Array.isArray(entry.afterJson.bulkItems)
                                    ? `${(entry.afterJson.bulkItems as unknown[]).length} bulk item(s)`
                                    : ""}
                                </span>
                              )}
                              {entry.action === "booking.items_removed" && entry.beforeJson && (
                                <span>
                                  {Array.isArray(entry.beforeJson.serializedAssetIds)
                                    ? `${(entry.beforeJson.serializedAssetIds as string[]).length} serialized item(s) `
                                    : ""}
                                  {Array.isArray(entry.beforeJson.bulkItems)
                                    ? `${(entry.beforeJson.bulkItems as unknown[]).length} bulk item(s)`
                                    : ""}
                                </span>
                              )}
                              {entry.action === "booking.items_qty_changed" && (
                                <span>Quantities updated</span>
                              )}
                            </div>
                          )}

                          {/* Admin-only diff toggle (D) */}
                          {isAdmin && (entry.beforeJson || entry.afterJson) && (
                            <>
                              <button className="diff-toggle" onClick={() => toggleDiff(entry.id)}>
                                {expandedDiffs.has(entry.id) ? "Hide diff" : "View diff"}
                              </button>
                              {expandedDiffs.has(entry.id) && (
                                <div className="diff-snapshot">
                                  {entry.beforeJson && (
                                    <div>
                                      <strong>Before:</strong>{"\n"}
                                      {JSON.stringify(entry.beforeJson, null, 2)}
                                    </div>
                                  )}
                                  {entry.afterJson && (
                                    <div className={entry.beforeJson ? "diff-after-section" : undefined}>
                                      <strong>After:</strong>{"\n"}
                                      {JSON.stringify(entry.afterJson, null, 2)}
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer actions */}
        {booking && !editMode && !equipEditMode && (
          <div className="sheet-actions">
            {canEdit && (
              <button className="btn btn-primary" onClick={enterEditMode}>Edit</button>
            )}
            {canCheckin && (
              <button
                className="btn btn-checkin"
                disabled={checkinLoading}
                onClick={handleCheckinAll}
              >
                {checkinLoading ? "Checking in..." : "Check in all"}
              </button>
            )}
            {canConvert && (
              <button className="btn btn-primary" onClick={handleConvert}>
                Start checkout
              </button>
            )}
            {canCancel && (
              <button className="btn btn-danger" onClick={handleCancel}>
                {booking.kind === "RESERVATION" ? "Cancel reservation" : "Cancel checkout"}
              </button>
            )}
            <Link
              href={booking.kind === "CHECKOUT" ? `/checkouts/${booking.id}` : `/reservations/${booking.id}`}
              className="btn btn-full-page"
            >
              Full page
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
