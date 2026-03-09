"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import DataList from "@/components/DataList";
import BookingDetailsSheet from "@/components/BookingDetailsSheet";

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
  status: string;
  computedStatus: string;
  notes: string | null;
  location: { name: string };
  department: { name: string } | null;
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

type TabKey = "checkouts" | "reservations" | "info" | "history";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "checkouts", label: "Check-outs" },
  { key: "reservations", label: "Reservations" },
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

function BookingKindTab({
  kind,
  groups,
  onSelectBooking,
}: {
  kind: "CHECKOUT" | "RESERVATION";
  groups: Array<{ month: string; items: AssetDetail["history"] }>;
  onSelectBooking: (id: string) => void;
}) {
  const label = kind === "CHECKOUT" ? "check-outs" : "reservations";
  const filtered = groups
    .map((g) => ({ month: g.month, items: g.items.filter((e) => e.booking.kind === kind) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div style={{ padding: 16 }}>
        {filtered.length === 0 ? (
          <div className="empty-state">No {label} yet for this item.</div>
        ) : (
          filtered.map((group) => (
            <div key={group.month} style={{ marginBottom: 16 }}>
              <h3 style={{ margin: "0 0 8px", fontSize: 18 }}>{group.month}</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Booking</th>
                    <th>Requester</th>
                    <th>When</th>
                    <th>Location</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((entry) => (
                    <tr key={entry.id} style={{ cursor: "pointer" }} onClick={() => onSelectBooking(entry.booking.id)}>
                      <td><span className="row-link">{entry.booking.title}</span></td>
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
  );
}

export default function ItemDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("checkouts");
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>("");

  useEffect(() => {
    fetch(`/api/assets/${id}`)
      .then((res) => res.ok ? res.json() : null)
      .then((json) => { if (json?.data) setAsset(json.data); });
    fetch("/api/me")
      .then((res) => res.ok ? res.json() : null)
      .then((json) => { if (json?.user?.role) setCurrentUserRole(json.user.role); });
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
        <span className={`badge ${
          asset.computedStatus === "AVAILABLE" ? "badge-green" :
          asset.computedStatus === "CHECKED_OUT" ? "badge-blue" :
          asset.computedStatus === "RESERVED" ? "badge-purple" :
          asset.computedStatus === "MAINTENANCE" ? "badge-orange" :
          "badge-gray"
        }`}>{
          asset.computedStatus === "CHECKED_OUT" ? "checked out" :
          asset.computedStatus.toLowerCase()
        }</span>
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

      {(activeTab === "checkouts" || activeTab === "reservations") && (
        <BookingKindTab
          kind={activeTab === "checkouts" ? "CHECKOUT" : "RESERVATION"}
          groups={historyByMonth}
          onSelectBooking={setSelectedBookingId}
        />
      )}

      {activeTab === "info" && (
        <div className="details-grid" style={{ marginTop: 14 }}>
          <div className="card details-card">
            <div className="card-header"><h2>Information</h2></div>
            <div style={{ padding: 16 }}>
              <DataList
                columns={2}
                items={[
                  { label: "Item name", value: asset.assetTag },
                  { label: "Brand", value: asset.brand },
                  { label: "Model", value: asset.model },
                  { label: "Category", value: asset.type },
                  { label: "Location", value: asset.location.name },
                  { label: "Purchase price", value: asset.purchasePrice ? `$${asset.purchasePrice}` : "—" },
                  { label: "Purchase date", value: formatDate(asset.purchaseDate) },
                  { label: "Serial number", value: <span style={{ fontFamily: "monospace" }}>{asset.serialNumber}</span> },
                  { label: "Description", value: asset.metadata?.description || "—" },
                  { label: "Owner", value: asset.metadata?.owner || "—" },
                  { label: "Department", value: asset.metadata?.department || "—" },
                  { label: "UW Asset Tag", value: asset.metadata?.uwAssetTag || "—" },
                  { label: "Fiscal Year", value: asset.metadata?.fiscalYearPurchased || "—" },
                ]}
              />
            </div>
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

      <BookingDetailsSheet
        bookingId={selectedBookingId}
        onClose={() => setSelectedBookingId(null)}
        currentUserRole={currentUserRole}
      />
    </>
  );
}
