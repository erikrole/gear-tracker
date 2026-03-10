"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import DataList from "@/components/DataList";
import type { ReservationAction } from "@/lib/reservation-actions";

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
    location?: { id: string; name: string };
  };
};

type BulkItem = {
  id: string;
  plannedQuantity: number;
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

type Reservation = {
  id: string;
  kind: "RESERVATION";
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
  auditLogs: AuditEntry[];
  itemLocations: LocationInfo[];
  locationMode: "SINGLE" | "MIXED";
  allowedActions?: ReservationAction[];
};

/* ───── Helpers ───── */

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const statusBadgeClass: Record<string, string> = {
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
  completed: "Completed",
  "booking.items_added": "Items added",
  "booking.items_removed": "Items removed",
  "booking.items_qty_changed": "Quantities updated",
  converted_to_checkout: "Converted to checkout",
};

const EQUIPMENT_ACTIONS = new Set([
  "booking.items_added",
  "booking.items_removed",
  "booking.items_qty_changed",
]);

type TabKey = "info" | "equipment" | "history";
type HistoryFilter = "all" | "booking" | "equipment";

/* ───── Component ───── */

export default function ReservationDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [fetchError, setFetchError] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [currentUserRole, setCurrentUserRole] = useState<string>("STUDENT");

  // Tabs
  const [tab, setTab] = useState<TabKey>("info");

  // Extend
  const [showExtend, setShowExtend] = useState(false);
  const [extendDate, setExtendDate] = useState("");

  // History
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [expandedDiffs, setExpandedDiffs] = useState<Set<string>>(new Set());

  // Equipment search
  const [equipSearch, setEquipSearch] = useState("");

  const reload = useCallback(() => {
    fetch(`/api/bookings/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((json) => {
        if (json?.data) setReservation(json.data);
        else setFetchError(true);
      })
      .catch(() => setFetchError(true));
  }, [id]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Fetch current user role
  useEffect(() => {
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data?.role) setCurrentUserRole(json.data.role);
      })
      .catch(() => {});
  }, []);

  const isAdmin = currentUserRole === "ADMIN";

  /* ── Actions ── */

  async function handleCancel() {
    if (!confirm("Cancel this reservation? This action cannot be undone."))
      return;
    setActionLoading("cancel");
    setActionError("");
    const res = await fetch(`/api/reservations/${id}/cancel`, {
      method: "POST",
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setActionError(
        (json as Record<string, string>).error || "Cancel failed"
      );
    } else {
      reload();
    }
    setActionLoading(null);
  }

  async function handleExtend() {
    if (!extendDate) return;
    setActionLoading("extend");
    setActionError("");
    const res = await fetch(`/api/bookings/${id}/extend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endsAt: new Date(extendDate).toISOString() }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setActionError(
        (json as Record<string, string>).error || "Extend failed"
      );
    } else {
      setShowExtend(false);
      setExtendDate("");
      reload();
    }
    setActionLoading(null);
  }

  function handleQuickExtend(days: number) {
    if (!reservation) return;
    const current = new Date(reservation.endsAt);
    current.setDate(current.getDate() + days);
    const pad = (n: number) => String(n).padStart(2, "0");
    setExtendDate(
      `${current.getFullYear()}-${pad(current.getMonth() + 1)}-${pad(current.getDate())}T${pad(current.getHours())}:${pad(current.getMinutes())}`
    );
    setShowExtend(true);
  }

  /* ── Derived ── */

  const actions = reservation?.allowedActions ?? [];
  const canEdit = actions.includes("edit");
  const canExtend = actions.includes("extend");
  const canCancel = actions.includes("cancel");
  const canConvert = actions.includes("convert");
  const isOverdue =
    reservation?.status === "BOOKED" && reservation?.endsAt
      ? new Date(reservation.endsAt) < new Date()
      : false;

  // Equipment filtering
  const filteredSerialized = useMemo(() => {
    if (!reservation || !equipSearch)
      return reservation?.serializedItems ?? [];
    const q = equipSearch.toLowerCase();
    return reservation.serializedItems.filter(
      (item) =>
        item.asset.assetTag.toLowerCase().includes(q) ||
        item.asset.brand?.toLowerCase().includes(q) ||
        item.asset.model?.toLowerCase().includes(q) ||
        item.asset.serialNumber?.toLowerCase().includes(q)
    );
  }, [reservation, equipSearch]);

  const filteredBulk = useMemo(() => {
    if (!reservation || !equipSearch) return reservation?.bulkItems ?? [];
    const q = equipSearch.toLowerCase();
    return reservation.bulkItems.filter((item) =>
      item.bulkSku.name.toLowerCase().includes(q)
    );
  }, [reservation, equipSearch]);

  // History filtering
  const filteredAuditLogs = useMemo(() => {
    if (!reservation) return [];
    if (historyFilter === "all") return reservation.auditLogs;
    if (historyFilter === "equipment") {
      return reservation.auditLogs.filter((e) =>
        EQUIPMENT_ACTIONS.has(e.action)
      );
    }
    return reservation.auditLogs.filter(
      (e) => !EQUIPMENT_ACTIONS.has(e.action)
    );
  }, [reservation, historyFilter]);

  function toggleDiff(entryId: string) {
    setExpandedDiffs((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  }

  // Build checkout conversion URL with prefill params
  const checkoutUrl = useMemo(() => {
    if (!reservation) return "/checkouts";
    const params = new URLSearchParams();
    params.set("fromReservation", reservation.id);
    params.set("title", reservation.title);
    params.set("locationId", reservation.location.id);
    params.set("startsAt", reservation.startsAt);
    params.set("endsAt", reservation.endsAt);
    params.set("requesterId", reservation.requester.id);
    return `/checkouts?new=1&${params}`;
  }, [reservation]);

  /* ── Render ── */

  if (fetchError) {
    return (
      <div className="empty-state">
        Reservation not found or failed to load.{" "}
        <Link href="/reservations">Back to reservations</Link>
      </div>
    );
  }

  if (!reservation) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
      </div>
    );
  }

  const itemCount =
    reservation.serializedItems.length + reservation.bulkItems.length;

  return (
    <>
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <Link href="/reservations">Reservations</Link> <span>&rsaquo;</span>{" "}
        {reservation.title}
      </div>

      {/* Header */}
      <div className="page-header" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1>{reservation.title}</h1>
          <span
            className={`badge ${statusBadgeClass[reservation.status] || "badge-gray"}`}
          >
            {reservation.status.toLowerCase()}
          </span>
          {isOverdue && <span className="badge badge-red">overdue</span>}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {canConvert && (
            <Link
              href={checkoutUrl}
              className="btn btn-primary btn-sm"
              style={{ textDecoration: "none" }}
            >
              Start checkout
            </Link>
          )}
          {canEdit && (
            <button
              className="btn btn-sm"
              onClick={() => router.push(`/reservations?editId=${id}`)}
              disabled={!!actionLoading}
            >
              Edit
            </button>
          )}
          {canExtend && (
            <button
              className="btn btn-sm"
              onClick={() => setShowExtend((v) => !v)}
              disabled={!!actionLoading}
            >
              Extend
            </button>
          )}
          {canCancel && (
            <button
              className="btn btn-sm"
              style={{ color: "var(--red)" }}
              onClick={handleCancel}
              disabled={!!actionLoading}
            >
              {actionLoading === "cancel" ? "Cancelling..." : "Cancel"}
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {actionError && (
        <div
          className="card"
          style={{
            padding: "10px 16px",
            marginBottom: 12,
            color: "var(--red)",
            border: "1px solid var(--red)",
          }}
        >
          {actionError}
        </div>
      )}

      {/* Extend panel */}
      {showExtend && (
        <div className="card" style={{ padding: 16, marginBottom: 12 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <label style={{ fontSize: 13, fontWeight: 600 }}>
              New end date:
            </label>
            <input
              type="datetime-local"
              value={extendDate}
              onChange={(e) => setExtendDate(e.target.value)}
              min={reservation.endsAt.slice(0, 16)}
              style={{
                padding: "6px 10px",
                border: "1px solid var(--border)",
                borderRadius: 6,
              }}
            />
            <button
              className="btn btn-primary btn-sm"
              onClick={handleExtend}
              disabled={!extendDate || !!actionLoading}
            >
              {actionLoading === "extend" ? "Saving..." : "Save"}
            </button>
            <button
              className="btn btn-sm"
              onClick={() => {
                setShowExtend(false);
                setExtendDate("");
              }}
            >
              Cancel
            </button>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            {[
              { label: "+1 day", days: 1 },
              { label: "+3 days", days: 3 },
              { label: "+1 week", days: 7 },
            ].map(({ label, days }) => (
              <button
                key={days}
                className="btn btn-sm"
                onClick={() => handleQuickExtend(days)}
                style={{ fontSize: 12 }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tab-bar" style={{ marginBottom: 16 }}>
        {(["info", "equipment", "history"] as TabKey[]).map((t) => (
          <button
            key={t}
            className={`tab-btn ${tab === t ? "active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t === "info"
              ? "Info"
              : t === "equipment"
                ? `Equipment (${itemCount})`
                : "History"}
          </button>
        ))}
      </div>

      {/* ── Info Tab ── */}
      {tab === "info" && (
        <div className="card details-card">
          <div style={{ padding: 16 }}>
            <DataList
              items={[
                { label: "Title", value: reservation.title },
                {
                  label: "Status",
                  value: (
                    <span
                      className={`badge ${statusBadgeClass[reservation.status] || "badge-gray"}`}
                    >
                      {reservation.status.toLowerCase()}
                    </span>
                  ),
                },
                { label: "Location", value: reservation.location.name },
                { label: "From", value: formatDate(reservation.startsAt) },
                { label: "To", value: formatDate(reservation.endsAt) },
                {
                  label: "Requester",
                  value: (
                    <>
                      {reservation.requester.name}{" "}
                      <span className="muted">
                        ({reservation.requester.email})
                      </span>
                    </>
                  ),
                },
                ...(reservation.creator
                  ? [{ label: "Created by", value: reservation.creator.name }]
                  : []),
                ...(reservation.notes
                  ? [{ label: "Notes", value: reservation.notes }]
                  : []),
                { label: "Created", value: formatDate(reservation.createdAt) },
              ]}
            />

            {/* Return location suggestion for mixed-location equipment */}
            {reservation.locationMode === "MIXED" &&
              reservation.itemLocations.length > 1 && (
                <div
                  style={{
                    marginTop: 12,
                    padding: "8px 12px",
                    background: "var(--surface-alt, #f8f9fa)",
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                >
                  Equipment spans multiple locations:{" "}
                  {reservation.itemLocations.map((l) => l.name).join(", ")}
                </div>
              )}
          </div>
        </div>
      )}

      {/* ── Equipment Tab ── */}
      {tab === "equipment" && (
        <div className="card details-card">
          {/* Search */}
          {itemCount > 3 && (
            <div style={{ padding: "12px 16px 0" }}>
              <input
                type="text"
                placeholder="Search equipment..."
                value={equipSearch}
                onChange={(e) => setEquipSearch(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  fontSize: 14,
                }}
              />
            </div>
          )}

          {filteredSerialized.length === 0 && filteredBulk.length === 0 ? (
            <div className="empty-state">
              {equipSearch
                ? "No items match your search."
                : "No items added to this reservation yet."}
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Brand / Model</th>
                  <th>Serial</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {filteredSerialized.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link
                        href={`/items/${item.asset.id}`}
                        style={{ fontWeight: 600, color: "var(--blue)" }}
                      >
                        {item.asset.assetTag}
                      </Link>
                    </td>
                    <td>
                      {item.asset.brand} {item.asset.model}
                    </td>
                    <td style={{ fontFamily: "monospace" }}>
                      {item.asset.serialNumber}
                    </td>
                    <td>{item.asset.location?.name ?? "\u2014"}</td>
                  </tr>
                ))}
                {filteredBulk.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600 }}>{item.bulkSku.name}</td>
                    <td>
                      Qty: {item.plannedQuantity}{" "}
                      <span className="muted">{item.bulkSku.unit}</span>
                    </td>
                    <td></td>
                    <td></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── History Tab ── */}
      {tab === "history" && (
        <div className="card details-card" style={{ padding: 16 }}>
          {/* Filter chips */}
          <div className="filter-chips" style={{ marginBottom: 12 }}>
            {(
              [
                ["all", "All"],
                ["booking", "Booking changes"],
                ["equipment", "Equipment changes"],
              ] as [HistoryFilter, string][]
            ).map(([key, label]) => (
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
              {historyFilter === "all"
                ? "No history yet"
                : "No matching history entries"}
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
                    {entry.actor.name} &middot;{" "}
                    {formatRelative(entry.createdAt)}
                  </div>

                  {/* Extended detail */}
                  {entry.action === "extended" &&
                    entry.afterJson &&
                    typeof entry.afterJson.endsAt === "string" && (
                      <div className="timeline-detail">
                        Extended to{" "}
                        {formatDate(entry.afterJson.endsAt as string)}
                      </div>
                    )}

                  {/* Updated fields */}
                  {entry.action === "updated" && entry.afterJson && (
                    <div className="timeline-detail">
                      {Object.keys(entry.afterJson)
                        .filter(
                          (k) =>
                            k !== "serializedAssetIds" && k !== "bulkItems"
                        )
                        .map((k) => (
                          <span key={k} style={{ marginRight: 8 }}>
                            {k}
                          </span>
                        ))}
                    </div>
                  )}

                  {/* Equipment change details */}
                  {EQUIPMENT_ACTIONS.has(entry.action) && (
                    <div className="timeline-detail">
                      {entry.action === "booking.items_added" &&
                        entry.afterJson && (
                          <span>
                            {Array.isArray(entry.afterJson.serializedAssetIds)
                              ? `${(entry.afterJson.serializedAssetIds as string[]).length} serialized item(s) `
                              : ""}
                            {Array.isArray(entry.afterJson.bulkItems)
                              ? `${(entry.afterJson.bulkItems as unknown[]).length} bulk item(s)`
                              : ""}
                          </span>
                        )}
                      {entry.action === "booking.items_removed" &&
                        entry.beforeJson && (
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

                  {/* Admin-only diff toggle */}
                  {isAdmin && (entry.beforeJson || entry.afterJson) && (
                    <>
                      <button
                        className="diff-toggle"
                        onClick={() => toggleDiff(entry.id)}
                      >
                        {expandedDiffs.has(entry.id)
                          ? "Hide diff"
                          : "View diff"}
                      </button>
                      {expandedDiffs.has(entry.id) && (
                        <div className="diff-snapshot">
                          {entry.beforeJson && (
                            <div>
                              <strong>Before:</strong>
                              {"\n"}
                              {JSON.stringify(entry.beforeJson, null, 2)}
                            </div>
                          )}
                          {entry.afterJson && (
                            <div
                              style={{
                                marginTop: entry.beforeJson ? 8 : 0,
                              }}
                            >
                              <strong>After:</strong>
                              {"\n"}
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
  );
}
