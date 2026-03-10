"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import DataList from "@/components/DataList";

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
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    fetch(`/api/checkouts/${id}`)
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((json) => { if (json?.data) setCheckout(json.data); else setFetchError(true); })
      .catch(() => setFetchError(true));
  }, [id]);

  if (fetchError) {
    return <div className="empty-state">Checkout not found or failed to load. <Link href="/checkouts">Back to checkouts</Link></div>;
  }

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
          <div style={{ padding: 16 }}>
            <DataList
              items={[
                { label: "Name", value: checkout.title },
                { label: "Location", value: checkout.location.name },
                { label: "From", value: formatDate(checkout.startsAt) },
                { label: "To", value: formatDate(checkout.endsAt) },
                { label: "User", value: <>{checkout.requester.name} <span className="muted">({checkout.requester.email})</span></> },
              ]}
            />
          </div>
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
