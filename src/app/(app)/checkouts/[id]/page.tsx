"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import DataList from "@/components/DataList";
import type { CheckoutAction } from "@/lib/booking-actions";
import { formatDateTime } from "@/lib/format";

type Checkout = {
  id: string;
  title: string;
  status: string;
  startsAt: string;
  endsAt: string;
  location: { name: string };
  requester: { id: string; name: string; email: string };
  serializedItems: Array<{ id: string; asset: { id: string; assetTag: string; brand: string; model: string; serialNumber: string } }>;
  bulkItems: Array<{ id: string; bulkSku: { name: string }; plannedQuantity: number; checkedOutQuantity: number | null }>;
  allowedActions: CheckoutAction[];
};

const statusBadgeClass: Record<string, string> = {
  DRAFT: "badge-gray",
  BOOKED: "badge-blue",
  OPEN: "badge-green",
  COMPLETED: "badge-purple",
  CANCELLED: "badge-red",
};

export default function CheckoutDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [fetchError, setFetchError] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [showExtend, setShowExtend] = useState(false);
  const [extendDate, setExtendDate] = useState("");
  const [checkinIds, setCheckinIds] = useState<Set<string>>(new Set());

  function reload() {
    fetch(`/api/checkouts/${id}`)
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((json) => { if (json?.data) setCheckout(json.data); else setFetchError(true); })
      .catch(() => setFetchError(true));
  }

  useEffect(() => { reload(); }, [id]);

  async function handleCancel() {
    if (!confirm("Cancel this checkout? This action cannot be undone.")) return;
    setActionLoading("cancel");
    setActionError("");
    const res = await fetch(`/api/bookings/${id}/cancel`, { method: "POST" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setActionError((json as Record<string, string>).error || "Cancel failed");
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
      setActionError((json as Record<string, string>).error || "Extend failed");
    } else {
      setShowExtend(false);
      setExtendDate("");
      reload();
    }
    setActionLoading(null);
  }

  async function handleCheckinSelected() {
    if (checkinIds.size === 0) return;
    setActionLoading("checkin");
    setActionError("");
    const res = await fetch(`/api/checkouts/${id}/checkin-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetIds: Array.from(checkinIds) }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setActionError((json as Record<string, string>).error || "Check-in failed");
    } else {
      setCheckinIds(new Set());
      reload();
    }
    setActionLoading(null);
  }

  async function handleCompleteCheckin() {
    if (!confirm("Complete check-in? Any items not yet returned will be flagged.")) return;
    setActionLoading("complete-checkin");
    setActionError("");
    const res = await fetch(`/api/checkouts/${id}/complete-checkin`, { method: "POST" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setActionError((json as Record<string, string>).error || "Complete check-in failed");
    } else {
      reload();
    }
    setActionLoading(null);
  }

  function handleEdit() {
    router.push(`/checkouts?editId=${id}`);
  }

  if (fetchError) {
    return <div className="empty-state">Checkout not found or failed to load. <Link href="/checkouts">Back to checkouts</Link></div>;
  }

  if (!checkout) {
    return <div className="loading-spinner"><div className="spinner" /></div>;
  }

  const actions = checkout.allowedActions ?? [];
  const canExtend = actions.includes("extend");
  const canCancel = actions.includes("cancel");
  const canCheckin = actions.includes("checkin");
  const canEdit = actions.includes("edit");
  const isOverdue = checkout.status === "OPEN" && new Date(checkout.endsAt) < new Date();

  return (
    <>
      <div className="breadcrumb"><Link href="/checkouts">Check-outs</Link> <span>&rsaquo;</span> {checkout.title}</div>
      <div className="page-header" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1>{checkout.title}</h1>
          <span className={`badge ${statusBadgeClass[checkout.status] || "badge-gray"}`}>{checkout.status.toLowerCase()}</span>
          {isOverdue && <span className="badge badge-red">overdue</span>}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {canEdit && (
            <button className="btn btn-sm" onClick={handleEdit} disabled={!!actionLoading}>Edit</button>
          )}
          {canExtend && (
            <button className="btn btn-sm" onClick={() => setShowExtend((v) => !v)} disabled={!!actionLoading}>
              Extend
            </button>
          )}
          {canCheckin && (
            <button className="btn btn-sm" onClick={handleCompleteCheckin} disabled={!!actionLoading}>
              {actionLoading === "complete-checkin" ? "Completing..." : "Complete check-in"}
            </button>
          )}
          {canCancel && (
            <button className="btn btn-sm" style={{ color: "var(--red)" }} onClick={handleCancel} disabled={!!actionLoading}>
              {actionLoading === "cancel" ? "Cancelling..." : "Cancel"}
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="card" style={{ padding: "10px 16px", marginBottom: 12, color: "var(--red)", border: "1px solid var(--red)" }}>
          {actionError}
        </div>
      )}

      {showExtend && (
        <div className="card" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>New end date:</label>
            <input
              type="datetime-local"
              value={extendDate}
              onChange={(e) => setExtendDate(e.target.value)}
              min={checkout.endsAt.slice(0, 16)}
              style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 6 }}
            />
            <button className="btn btn-primary btn-sm" onClick={handleExtend} disabled={!extendDate || !!actionLoading}>
              {actionLoading === "extend" ? "Saving..." : "Save"}
            </button>
            <button className="btn btn-sm" onClick={() => { setShowExtend(false); setExtendDate(""); }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="details-grid">
        <div className="card details-card">
          <div className="card-header"><h2>Check-out details</h2></div>
          <div style={{ padding: 16 }}>
            <DataList
              items={[
                { label: "Name", value: checkout.title },
                { label: "Location", value: checkout.location?.name ?? "\u2014" },
                { label: "From", value: formatDateTime(checkout.startsAt) },
                { label: "To", value: formatDateTime(checkout.endsAt) },
                { label: "User", value: <>{checkout.requester?.name ?? "Unknown"} <span className="muted">({checkout.requester?.email ?? ""})</span></> },
              ]}
            />
          </div>
        </div>

        <div className="card details-card">
          <div className="card-header" style={{ justifyContent: "space-between" }}>
            <h2>Equipment</h2>
            {canCheckin && checkinIds.size > 0 && (
              <button className="btn btn-primary btn-sm" onClick={handleCheckinSelected} disabled={!!actionLoading}>
                {actionLoading === "checkin" ? "Returning..." : `Return ${checkinIds.size} item${checkinIds.size > 1 ? "s" : ""}`}
              </button>
            )}
          </div>
          {checkout.serializedItems.length === 0 && checkout.bulkItems.length === 0 ? (
            <div className="empty-state">No items in this check-out.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  {canCheckin && <th style={{ width: 32 }}></th>}
                  <th>Item</th>
                  <th>Brand/Model</th>
                  <th>Serial</th>
                </tr>
              </thead>
              <tbody>
                {checkout.serializedItems.map((item) => (
                  <tr key={item.id}>
                    {canCheckin && (
                      <td>
                        <input
                          type="checkbox"
                          checked={checkinIds.has(item.asset.id)}
                          onChange={() => {
                            setCheckinIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(item.asset.id)) next.delete(item.asset.id);
                              else next.add(item.asset.id);
                              return next;
                            });
                          }}
                          style={{ width: 16, height: 16 }}
                        />
                      </td>
                    )}
                    <td>
                      <Link href={`/items/${item.asset.id}`} style={{ fontWeight: 600, color: "var(--blue)" }}>
                        {item.asset.assetTag}
                      </Link>
                    </td>
                    <td>{item.asset.brand} {item.asset.model}</td>
                    <td style={{ fontFamily: "monospace" }}>{item.asset.serialNumber}</td>
                  </tr>
                ))}
                {checkout.bulkItems.map((item) => (
                  <tr key={item.id}>
                    {canCheckin && <td></td>}
                    <td style={{ fontWeight: 600 }}>{item.bulkSku?.name ?? "Unknown"}</td>
                    <td>Qty: {item.checkedOutQuantity ?? item.plannedQuantity}</td>
                    <td></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
