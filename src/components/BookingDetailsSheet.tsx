"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import DataList from "@/components/DataList";

/* ───── Types ───── */

type SerializedItem = {
  id: string;
  asset: {
    id: string;
    assetTag: string;
    brand: string;
    model: string;
    serialNumber: string;
    type: string;
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

type BookingDetail = {
  id: string;
  kind: "RESERVATION" | "CHECKOUT";
  title: string;
  status: string;
  startsAt: string;
  endsAt: string;
  notes: string | null;
  createdAt: string;
  location: { id: string; name: string };
  requester: { id: string; name: string; email: string };
  creator?: { id: string; name: string; email: string };
  serializedItems: SerializedItem[];
  bulkItems: BulkItem[];
  isOverdue: boolean;
  isActive: boolean;
  bookingType: string;
  auditLogs: AuditEntry[];
};

type TabKey = "info" | "equipment" | "history";

type Props = {
  bookingId: string | null;
  onClose: () => void;
  onUpdated?: () => void;
};

/* ───── Helpers ───── */

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

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

const actionLabels: Record<string, string> = {
  created: "Created",
  updated: "Updated",
  extended: "Extended",
  cancelled: "Cancelled",
  checkin_completed: "Check-in completed",
  cancelled_by_checkout_conversion: "Converted to checkout",
};

/* ───── Component ───── */

export default function BookingDetailsSheet({ bookingId, onClose, onUpdated }: Props) {
  const { toast } = useToast();
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

  const fetchBooking = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}`);
      if (res.ok) {
        const json = await res.json();
        setBooking(json.data);
      }
    } catch { /* network */ }
    setLoading(false);
  }, [bookingId]);

  useEffect(() => {
    if (bookingId) {
      fetchBooking();
      setTab("info");
      setEditMode(false);
    }
  }, [bookingId, fetchBooking]);

  if (!bookingId) return null;

  function enterEditMode() {
    if (!booking) return;
    setEditTitle(booking.title);
    setEditStartsAt(toLocalDateTimeValue(new Date(booking.startsAt)));
    setEditEndsAt(toLocalDateTimeValue(new Date(booking.endsAt)));
    setEditNotes(booking.notes || "");
    setEditMode(true);
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
    if (!confirm(`Cancel "${booking.title}"? This cannot be undone.`)) return;

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

  const canEdit = booking && (booking.status === "BOOKED" || booking.status === "OPEN");
  const canCancel = booking && (booking.status === "BOOKED" || booking.status === "OPEN");
  const canExtend = booking && booking.status === "OPEN";

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

  return (
    <>
      {/* Overlay */}
      <div className="sheet-overlay" onClick={onClose} />

      {/* Panel */}
      <div className="sheet-panel">
        {/* Header */}
        <div className="sheet-header">
          <div>
            <h2>{booking?.title || "Loading..."}</h2>
            {booking && (
              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                <span className={`badge ${statusBadge[booking.status] || "badge-gray"}`}>
                  {booking.isOverdue ? "overdue" : booking.status.toLowerCase()}
                </span>
                <span className="badge badge-gray">{booking.bookingType}</span>
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
                        { label: "Location", value: booking.location.name },
                        { label: "Start", value: formatDateTime(booking.startsAt) },
                        { label: "Due", value: formatDateTime(booking.endsAt) },
                        { label: "Requester", value: `${booking.requester.name} (${booking.requester.email})` },
                        ...(booking.notes ? [{ label: "Notes", value: booking.notes }] : []),
                      ]}
                    />
                  </div>

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

                  <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
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

              {/* ── Equipment Tab ── */}
              {tab === "equipment" && (
                <>
                  <div className="sheet-section" style={{ paddingBottom: 8 }}>
                    <input
                      placeholder="Search equipment..."
                      value={equipSearch}
                      onChange={(e) => setEquipSearch(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius)",
                        fontSize: 13,
                        outline: "none",
                      }}
                    />
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
                          </tr>
                        </thead>
                        <tbody>
                          {filteredSerializedItems.map((item) => (
                            <tr key={item.id}>
                              <td style={{ fontWeight: 600 }}>
                                <Link href={`/items/${item.asset.id}`} className="row-link">{item.asset.assetTag}</Link>
                              </td>
                              <td>{item.asset.brand} {item.asset.model}</td>
                              <td style={{ fontFamily: "monospace", fontSize: 11 }}>{item.asset.serialNumber}</td>
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
                              <td style={{ fontWeight: 600 }}>{item.bulkSku.name}</td>
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

              {/* ── History Tab ── */}
              {tab === "history" && (
                <div className="sheet-section">
                  {booking.auditLogs.length === 0 ? (
                    <div className="empty-state">No history yet</div>
                  ) : (
                    booking.auditLogs.map((entry) => (
                      <div className="timeline-item" key={entry.id}>
                        <div className={`timeline-dot action-${entry.action}`} />
                        <div className="timeline-content">
                          <div className="timeline-action">
                            {actionLabels[entry.action] || entry.action}
                          </div>
                          <div className="timeline-meta">
                            {entry.actor.name} &middot; {formatRelative(entry.createdAt)}
                          </div>
                          {entry.action === "extended" && entry.afterJson && typeof entry.afterJson.endsAt === "string" && (
                            <div className="timeline-detail">
                              Extended to {formatDateTime(entry.afterJson.endsAt)}
                            </div>
                          )}
                          {entry.action === "updated" && entry.afterJson && (
                            <div className="timeline-detail">
                              {Object.keys(entry.afterJson).filter((k) => k !== "serializedAssetIds" && k !== "bulkItems").map((k) => (
                                <span key={k} style={{ marginRight: 8 }}>{k}</span>
                              ))}
                            </div>
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
        {booking && !editMode && (
          <div className="sheet-actions">
            {canEdit && (
              <button className="btn btn-primary" onClick={enterEditMode}>Edit</button>
            )}
            {canCancel && (
              <button className="btn btn-danger" onClick={handleCancel}>
                {booking.kind === "RESERVATION" ? "Cancel reservation" : "Cancel checkout"}
              </button>
            )}
            <Link
              href={booking.kind === "CHECKOUT" ? `/checkouts/${booking.id}` : `/reservations/${booking.id}`}
              className="btn"
              style={{ textDecoration: "none", marginLeft: "auto" }}
            >
              Full page
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
