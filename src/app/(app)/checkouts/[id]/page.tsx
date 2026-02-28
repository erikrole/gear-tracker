"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Checkout = {
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

export default function CheckoutDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [checkout, setCheckout] = useState<Checkout | null>(null);

  useEffect(() => {
    fetch(`/api/checkouts/${id}`)
      .then((res) => res.ok ? res.json() : null)
      .then((json) => { if (json?.data) setCheckout(json.data); });
  }, [id]);

  if (!checkout) {
    return <div className="loading-spinner"><div className="spinner" /></div>;
  }

  return (
    <>
      <div className="breadcrumb"><Link href="/checkouts">Check-outs</Link> <span>›</span> {checkout.title}</div>
      <div className="page-header" style={{ marginBottom: 12 }}>
        <h1>{checkout.title}</h1>
        <span className={`badge ${checkout.status === "OPEN" ? "badge-green" : "badge-gray"}`}>{checkout.status.toLowerCase()}</span>
      </div>

      <div className="details-grid">
        <div className="card details-card">
          <div className="card-header"><h2>Check-out details</h2></div>
          <dl className="details-list">
            <div><dt>Name</dt><dd>{checkout.title}</dd></div>
            <div><dt>Location</dt><dd>{checkout.location.name}</dd></div>
            <div><dt>From</dt><dd>{formatDate(checkout.startsAt)}</dd></div>
            <div><dt>To</dt><dd>{formatDate(checkout.endsAt)}</dd></div>
            <div><dt>User</dt><dd>{checkout.requester.name} <span className="muted">({checkout.requester.email})</span></dd></div>
          </dl>
        </div>

        <div className="card details-card">
          <div className="card-header"><h2>Equipment</h2></div>
          {checkout.serializedItems.length === 0 ? (
            <div className="empty-state">No items added to this check-out yet.</div>
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
                {checkout.serializedItems.map((item) => (
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
