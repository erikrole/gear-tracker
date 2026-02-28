"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Reservation = {
  id: string;
  title: string;
  status: string;
  startsAt: string;
  endsAt: string;
  location: { name: string };
  requester: { name: string; email: string };
  serializedItems: Array<{ id: string; asset: { id: string; assetTag: string; brand: string; model: string; serialNumber: string } }>;
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

export default function ReservationDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [reservation, setReservation] = useState<Reservation | null>(null);

  useEffect(() => {
    fetch(`/api/reservations/${id}`)
      .then((res) => res.ok ? res.json() : null)
      .then((json) => { if (json?.data) setReservation(json.data); });
  }, [id]);

  if (!reservation) {
    return <div className="loading-spinner"><div className="spinner" /></div>;
  }

  return (
    <>
      <div className="breadcrumb"><Link href="/reservations">Reservations</Link> <span>›</span> {reservation.title}</div>
      <div className="page-header" style={{ marginBottom: 12 }}>
        <h1>{reservation.title}</h1>
        <span className={`badge ${reservation.status === "BOOKED" ? "badge-blue" : "badge-gray"}`}>{reservation.status.toLowerCase()}</span>
      </div>

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
          {reservation.serializedItems.length === 0 ? (
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
                    <td style={{ fontWeight: 600 }}>{item.asset.assetTag}</td>
                    <td>{item.asset.brand} {item.asset.model}</td>
                    <td style={{ fontFamily: "monospace" }}>{item.asset.serialNumber}</td>
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
