"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type AssetDetail = {
  id: string;
  assetTag: string;
  type: string;
  brand: string;
  model: string;
  serialNumber: string;
  qrCodeValue: string;
  purchaseDate: string | null;
  purchasePrice: string | number | null;
  status: "AVAILABLE" | "MAINTENANCE" | "RETIRED";
  notes: string | null;
  location: { name: string };
  metadata: Record<string, string> | null;
  history: Array<{
    id: string;
    createdAt: string;
    booking: {
      id: string;
      kind: "RESERVATION" | "CHECKOUT";
      status: string;
      title: string;
      startsAt: string;
      endsAt: string;
      requester: { name: string; email: string };
      location: { name: string };
    };
  }>;
};

type TabKey = "dashboard" | "info" | "history";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "dashboard", label: "Dashboard" },
  { key: "info", label: "Info" },
  { key: "history", label: "History" }
];

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export default function ItemDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");

  useEffect(() => {
    fetch(`/api/assets/${id}`)
      .then((res) => res.json())
      .then((json) => setAsset(json.data));
  }, [id]);

  const historyByMonth = useMemo(() => {
    if (!asset) return [] as Array<{ month: string; items: AssetDetail["history"] }>;
    const groups = new Map<string, AssetDetail["history"]>();

    for (const item of asset.history) {
      const month = new Date(item.booking.startsAt).toLocaleDateString("en-US", { month: "long", year: "numeric" });
      groups.set(month, [...(groups.get(month) || []), item]);
    }

    return Array.from(groups.entries()).map(([month, items]) => ({ month, items }));
  }, [asset]);

  if (!asset) {
    return <div className="loading-spinner"><div className="spinner" /></div>;
  }

  return (
    <>
      <div className="breadcrumb"><Link href="/items">Items</Link> <span>›</span> {asset.assetTag}</div>
      <div className="page-header" style={{ marginBottom: 6 }}>
        <h1>{asset.assetTag}</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn">Actions</button>
          <button className="btn btn-primary">Reserve</button>
          <button className="btn btn-primary">Check out</button>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, color: "var(--text-secondary)" }}>
        <span className={`badge ${asset.status === "AVAILABLE" ? "badge-green" : "badge-gray"}`}>{asset.status.toLowerCase()}</span>
        <span style={{ fontFamily: "monospace" }}>{asset.qrCodeValue}</span>
        <span style={{ fontFamily: "monospace" }}>{asset.serialNumber}</span>
      </div>

      <div className="item-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`item-tab ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "dashboard" && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="card-header"><h2>Bookings</h2></div>
          <div style={{ padding: 16 }}>
            {historyByMonth.length === 0 ? (
              <div className="empty-state">No bookings yet for this item.</div>
            ) : (
              historyByMonth.map((group) => (
                <div key={group.month} style={{ marginBottom: 16 }}>
                  <h3 style={{ margin: "0 0 8px", fontSize: 18 }}>{group.month}</h3>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Booking</th>
                        <th>Requester</th>
                        <th>When</th>
                        <th>Location</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((entry) => (
                        <tr key={entry.id}>
                          <td>{entry.booking.kind.toLowerCase()}</td>
                          <td>
                            {entry.booking.kind === "CHECKOUT" ? (
                              <Link className="row-link" href={`/checkouts/${entry.booking.id}`}>{entry.booking.title}</Link>
                            ) : (
                              <Link className="row-link" href={`/reservations/${entry.booking.id}`}>{entry.booking.title}</Link>
                            )}
                          </td>
                          <td>{entry.booking.requester.name}</td>
                          <td>{formatDate(entry.booking.startsAt)}</td>
                          <td>{entry.booking.location.name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === "info" && (
        <div className="details-grid" style={{ marginTop: 14 }}>
          <div className="card details-card">
            <div className="card-header"><h2>Information</h2></div>
            <dl className="details-list">
              <div><dt>Item name</dt><dd>{asset.assetTag}</dd></div>
              <div><dt>Brand</dt><dd>{asset.brand}</dd></div>
              <div><dt>Model</dt><dd>{asset.model}</dd></div>
              <div><dt>Category</dt><dd>{asset.type}</dd></div>
              <div><dt>Location</dt><dd>{asset.location.name}</dd></div>
              <div><dt>Purchase price</dt><dd>{asset.purchasePrice ? `$${asset.purchasePrice}` : "—"}</dd></div>
              <div><dt>Purchase date</dt><dd>{formatDate(asset.purchaseDate)}</dd></div>
              <div><dt>Serial number</dt><dd style={{ fontFamily: "monospace" }}>{asset.serialNumber}</dd></div>
              <div><dt>Description</dt><dd>{asset.metadata?.description || "—"}</dd></div>
              <div><dt>Owner</dt><dd>{asset.metadata?.owner || "—"}</dd></div>
              <div><dt>Department</dt><dd>{asset.metadata?.department || "—"}</dd></div>
              <div><dt>UW Asset Tag</dt><dd>{asset.metadata?.uwAssetTag || "—"}</dd></div>
              <div><dt>Fiscal Year</dt><dd>{asset.metadata?.fiscalYearPurchased || "—"}</dd></div>
            </dl>
          </div>

          <div style={{ display: "grid", gap: 16 }}>
            <div className="card">
              <div className="card-header"><h2>Tracking codes</h2></div>
              <div style={{ padding: 16, display: "grid", gap: 12 }}>
                <div className="tracking-row"><span>QR</span><strong style={{ fontFamily: "monospace" }}>{asset.qrCodeValue}</strong></div>
                <div className="tracking-row"><span>Serial</span><strong style={{ fontFamily: "monospace" }}>{asset.serialNumber}</strong></div>
              </div>
            </div>
            <div className="card">
              <div className="card-header"><h2>Location details</h2></div>
              <div style={{ padding: 16 }}>{asset.location.name}</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "history" && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="card-header"><h2>History</h2></div>
          <div style={{ padding: 16 }}>
            {asset.history.length === 0 ? (
              <div className="empty-state">No history yet for this item.</div>
            ) : (
              <div className="history-feed">
                {asset.history.map((entry) => (
                  <div className="history-row" key={entry.id}>
                    <div className="history-dot">{entry.booking.requester.name.slice(0, 1).toUpperCase()}</div>
                    <div>
                      <div>
                        <strong>{entry.booking.requester.name}</strong> {entry.booking.kind === "CHECKOUT" ? "checked out" : "reserved"} this item at <strong>{entry.booking.location.name}</strong>
                      </div>
                      <div className="muted">{formatDateTime(entry.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
