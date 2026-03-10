"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Reservation = {
  id: string;
  title: string;
  status: string;
  startsAt: string;
  endsAt: string;
  location: { id: string; name: string };
  requester: { id: string; name: string; email: string };
  serializedItems: Array<{ id: string; asset: { id: string; assetTag: string; brand: string; model: string; serialNumber: string } }>;
  bulkItems: Array<{ id: string; bulkSku: { name: string }; plannedQuantity: number }>;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

const statusBadgeClass: Record<string, string> = {
  DRAFT: "badge-gray",
  BOOKED: "badge-blue",
  OPEN: "badge-green",
  COMPLETED: "badge-purple",
  CANCELLED: "badge-red",
};

export default function ReservationDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [fetchError, setFetchError] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  function reload() {
    fetch(`/api/reservations/${id}`)
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((json) => { if (json?.data) setReservation(json.data); else setFetchError(true); })
      .catch(() => setFetchError(true));
  }

  useEffect(() => { reload(); }, [id]);

  async function handleCancel() {
    if (!confirm("Cancel this reservation? This action cannot be undone.")) return;
    setActionLoading("cancel");
    setActionError("");
    const res = await fetch(`/api/reservations/${id}/cancel`, { method: "POST" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setActionError((json as Record<string, string>).error || "Cancel failed");
    } else {
      reload();
    }
    setActionLoading(null);
  }

  async function handleExtend() {
    // Reservations use the generic bookings extend endpoint
    const newEnd = prompt("New end date (YYYY-MM-DD HH:MM):");
    if (!newEnd) return;
    setActionLoading("extend");
    setActionError("");
    const res = await fetch(`/api/bookings/${id}/extend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endsAt: new Date(newEnd).toISOString() }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setActionError((json as Record<string, string>).error || "Extend failed");
    } else {
      reload();
    }
    setActionLoading(null);
  }

  if (fetchError) {
    return <div className="empty-state">Reservation not found or failed to load. <Link href="/reservations">Back to reservations</Link></div>;
  }

  if (!reservation) {
    return <div className="loading-spinner"><div className="spinner" /></div>;
  }

  const isActionable = reservation.status === "BOOKED" || reservation.status === "DRAFT";
  const canProceedToCheckout = reservation.status === "BOOKED";

  // Build the "proceed to checkout" link with prefilled params
  const checkoutParams = new URLSearchParams();
  checkoutParams.set("fromReservation", reservation.id);
  checkoutParams.set("title", reservation.title);
  checkoutParams.set("locationId", reservation.location.id);
  checkoutParams.set("startsAt", reservation.startsAt);
  checkoutParams.set("endsAt", reservation.endsAt);
  checkoutParams.set("requesterId", reservation.requester.id);
  const checkoutUrl = `/checkouts?new=1&${checkoutParams}`;

  return (
    <>
      <div className="breadcrumb"><Link href="/reservations">Reservations</Link> <span>&rsaquo;</span> {reservation.title}</div>
      <div className="page-header" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1>{reservation.title}</h1>
          <span className={`badge ${statusBadgeClass[reservation.status] || "badge-gray"}`}>{reservation.status.toLowerCase()}</span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {canProceedToCheckout && (
            <Link href={checkoutUrl} className="btn btn-primary btn-sm" style={{ textDecoration: "none" }}>
              Proceed to check-out
            </Link>
          )}
          {isActionable && (
            <button className="btn btn-sm" onClick={handleExtend} disabled={!!actionLoading}>
              Extend
            </button>
          )}
          {isActionable && (
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

      <div className="details-grid">
        <div className="card details-card">
          <div className="card-header"><h2>Reservation details</h2></div>
          <dl className="details-list">
            <div><dt>Name</dt><dd>{reservation.title}</dd></div>
            <div><dt>Location</dt><dd>{reservation.location.name}</dd></div>
            <div><dt>From</dt><dd>{formatDate(reservation.startsAt)}</dd></div>
            <div><dt>To</dt><dd>{formatDate(reservation.endsAt)}</dd></div>
            <div><dt>User</dt><dd>{reservation.requester.name} <span className="muted">({reservation.requester.email})</span></dd></div>
          </dl>
        </div>

        <div className="card details-card">
          <div className="card-header"><h2>Equipment</h2></div>
          {reservation.serializedItems.length === 0 && reservation.bulkItems.length === 0 ? (
            <div className="empty-state">No items added to this reservation yet.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Brand/Model</th>
                  <th>Serial</th>
                </tr>
              </thead>
              <tbody>
                {reservation.serializedItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link href={`/items/${item.asset.id}`} style={{ fontWeight: 600, color: "var(--blue)" }}>
                        {item.asset.assetTag}
                      </Link>
                    </td>
                    <td>{item.asset.brand} {item.asset.model}</td>
                    <td style={{ fontFamily: "monospace" }}>{item.asset.serialNumber}</td>
                  </tr>
                ))}
                {reservation.bulkItems.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600 }}>{item.bulkSku.name}</td>
                    <td>Qty: {item.plannedQuantity}</td>
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
