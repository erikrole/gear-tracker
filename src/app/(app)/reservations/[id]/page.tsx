"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import DataList from "@/components/DataList";
import { Spinner } from "@/components/ui/spinner";
import type { ReservationAction } from "@/lib/booking-actions";
import { formatDateTime } from "@/lib/format";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";

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

const statusBadgeVariant: Record<string, BadgeProps["variant"]> = {
  DRAFT: "gray",
  BOOKED: "blue",
  OPEN: "green",
  COMPLETED: "purple",
  CANCELLED: "red",
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
  const confirm = useConfirm();
  const { toast } = useToast();
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
    const ok = await confirm({
      title: "Cancel reservation",
      message: "Cancel this reservation? This action cannot be undone.",
      confirmLabel: "Cancel reservation",
      variant: "danger",
    });
    if (!ok) return;
    setActionLoading("cancel");
    setActionError("");
    try {
      const res = await fetch(`/api/reservations/${id}/cancel`, {
        method: "POST",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast((json as Record<string, string>).error || "Cancel failed", "error");
      } else {
        await reload();
      }
    } catch {
      toast("Network error \u2014 please try again.", "error");
    }
    setActionLoading(null);
  }

  async function handleExtend() {
    if (!extendDate) return;
    setActionLoading("extend");
    setActionError("");
    try {
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
        await reload();
      }
    } catch {
      setActionError("Network error — please try again.");
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
  const canDuplicate = actions.includes("duplicate");
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

  async function handleConvert() {
    const ok = await confirm({
      title: "Convert to checkout",
      message: "Convert this reservation to a checkout? The reservation will be cancelled and a new checkout created with the same items.",
      confirmLabel: "Start checkout",
    });
    if (!ok) return;
    setActionLoading("convert");
    setActionError("");
    try {
      const res = await fetch(`/api/reservations/${id}/convert`, {
        method: "POST",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast((json as Record<string, string>).error || "Conversion failed", "error");
      } else {
        const json = await res.json().catch(() => ({}));
        const checkoutId = (json as { data?: { id?: string } })?.data?.id;
        if (checkoutId) {
          router.push(`/checkouts/${checkoutId}`);
        } else {
          router.push("/checkouts");
        }
        return; // navigating away — don't clear loading
      }
    } catch {
      toast("Network error during conversion", "error");
    }
    setActionLoading(null);
  }

  async function handleDuplicate() {
    setActionLoading("duplicate");
    setActionError("");
    try {
      const res = await fetch(`/api/reservations/${id}/duplicate`, {
        method: "POST",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast((json as Record<string, string>).error || "Duplicate failed", "error");
      } else {
        const json = await res.json().catch(() => ({}));
        const newId = (json as { data?: { id?: string } })?.data?.id;
        if (newId) {
          router.push(`/reservations/${newId}`);
        } else {
          router.push("/reservations");
        }
        return;
      }
    } catch {
      toast("Network error \u2014 please try again.", "error");
    }
    setActionLoading(null);
  }

  /* ── Render ── */

  if (fetchError) {
    return (
      <div className="py-10 px-5 text-center text-muted-foreground">
        Reservation not found or failed to load.{" "}
        <Link href="/reservations">Back to reservations</Link>
      </div>
    );
  }

  if (!reservation) {
    return <div className="flex items-center justify-center py-10"><Spinner className="size-8" /></div>;
  }

  const itemCount =
    reservation.serializedItems.length + reservation.bulkItems.length;

  return (
    <>
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <Link href="/reservations">Reservations</Link> <span>{"\u203a"}</span>{" "}
        {reservation.title}
      </div>

      {/* Header */}
      <div className="page-header" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1>{reservation.title}</h1>
          <Badge
            variant={statusBadgeVariant[reservation.status] || "gray"}
          >
            {reservation.status.toLowerCase()}
          </Badge>
          {isOverdue && <Badge variant="red">overdue</Badge>}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {canConvert && (
            <Button
              size="sm"
              onClick={handleConvert}
              disabled={!!actionLoading}
            >
              {actionLoading === "convert" ? "Converting..." : "Start checkout"}
            </Button>
          )}
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/reservations?editId=${id}`)}
              disabled={!!actionLoading}
            >
              Edit
            </Button>
          )}
          {canExtend && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowExtend((v) => !v)}
              disabled={!!actionLoading}
            >
              Extend
            </Button>
          )}
          {canDuplicate && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDuplicate}
              disabled={!!actionLoading}
            >
              {actionLoading === "duplicate" ? "Duplicating..." : "Duplicate"}
            </Button>
          )}
          {canCancel && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleCancel}
              disabled={!!actionLoading}
            >
              {actionLoading === "cancel" ? "Cancelling..." : "Cancel"}
            </Button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {actionError && (
        <div className="alert-error">{actionError}</div>
      )}

      {/* Extend panel */}
      {showExtend && (
        <Card style={{ padding: 16, marginBottom: 12 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <label style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>
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
            <Button
              size="sm"
              onClick={handleExtend}
              disabled={!extendDate || !!actionLoading}
            >
              {actionLoading === "extend" ? "Saving..." : "Save"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowExtend(false);
                setExtendDate("");
              }}
            >
              Cancel
            </Button>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            {[
              { label: "+1 day", days: 1 },
              { label: "+3 days", days: 3 },
              { label: "+1 week", days: 7 },
            ].map(({ label, days }) => (
              <Button
                key={days}
                variant="outline"
                size="sm"
                onClick={() => handleQuickExtend(days)}
                style={{ fontSize: "var(--text-xs)" }}
              >
                {label}
              </Button>
            ))}
          </div>
        </Card>
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
        <Card className="details-card">
          <div style={{ padding: 16 }}>
            <DataList
              items={[
                { label: "Title", value: reservation.title },
                {
                  label: "Status",
                  value: (
                    <Badge
                      variant={statusBadgeVariant[reservation.status] || "gray"}
                    >
                      {reservation.status.toLowerCase()}
                    </Badge>
                  ),
                },
                { label: "Location", value: reservation.location?.name ?? "\u2014" },
                { label: "From", value: formatDateTime(reservation.startsAt) },
                { label: "To", value: formatDateTime(reservation.endsAt) },
                {
                  label: "Requester",
                  value: (
                    <>
                      {reservation.requester?.name ?? "Unknown"}{" "}
                      <span className="muted">
                        ({reservation.requester?.email ?? ""})
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
                { label: "Created", value: formatDateTime(reservation.createdAt) },
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
                    fontSize: "var(--text-sm)",
                  }}
                >
                  Equipment spans multiple locations:{" "}
                  {reservation.itemLocations.map((l) => l.name).join(", ")}
                </div>
              )}
          </div>
        </Card>
      )}

      {/* ── Equipment Tab ── */}
      {tab === "equipment" && (
        <Card className="details-card">
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
                  fontSize: "var(--text-base)",
                }}
              />
            </div>
          )}

          {filteredSerialized.length === 0 && filteredBulk.length === 0 ? (
            <div className="py-10 px-5 text-center text-muted-foreground">
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
        </Card>
      )}

      {/* ── History Tab ── */}
      {tab === "history" && (
        <Card className="details-card" style={{ padding: 16 }}>
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
            <div className="py-10 px-5 text-center text-muted-foreground">
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
                    {entry.actor.name} {"\u00b7"}{" "}
                    {formatRelative(entry.createdAt)}
                  </div>

                  {/* Extended detail */}
                  {entry.action === "extended" &&
                    entry.afterJson &&
                    typeof entry.afterJson.endsAt === "string" && (
                      <div className="timeline-detail">
                        Extended to{" "}
                        {formatDateTime(entry.afterJson.endsAt as string)}
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
        </Card>
      )}
    </>
  );
}
