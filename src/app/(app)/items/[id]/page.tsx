"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
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
  category: { id: string; name: string } | null;
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

function EditableField({
  label,
  value,
  canEdit,
  onSave,
  mono,
}: {
  label: string;
  value: string;
  canEdit: boolean;
  onSave: (v: string) => Promise<void>;
  mono?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  async function commit() {
    const trimmed = draft.trim();
    if (trimmed === value) { setEditing(false); return; }
    setSaving(true);
    await onSave(trimmed);
    setSaving(false);
    setEditing(false);
  }

  return (
    <div className="data-list-row">
      <dt className="data-list-label">{label}</dt>
      <dd className="data-list-value" style={mono ? { fontFamily: "monospace" } : undefined}>
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
            disabled={saving}
            style={{
              width: "100%",
              padding: "2px 6px",
              border: "1px solid var(--border)",
              borderRadius: 4,
              fontSize: 13,
              fontFamily: mono ? "monospace" : "inherit",
              textAlign: "right",
              outline: "none",
            }}
          />
        ) : (
          <span
            onClick={() => canEdit && setEditing(true)}
            style={{
              cursor: canEdit ? "pointer" : "default",
              borderBottom: canEdit ? "1px dashed var(--border)" : "none",
              padding: "0 2px",
            }}
            title={canEdit ? "Click to edit" : undefined}
          >
            {value || "—"}
          </span>
        )}
      </dd>
    </div>
  );
}

function EditableInfoCard({
  asset,
  canEdit,
  onFieldSaved,
}: {
  asset: AssetDetail;
  canEdit: boolean;
  onFieldSaved: (updated: Partial<AssetDetail>) => void;
}) {
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  async function saveField(patchKey: string, value: string) {
    setFeedback(null);
    try {
      const body: Record<string, unknown> = {};

      if (patchKey === "purchasePrice") {
        const num = parseFloat(value);
        if (value && isNaN(num)) { setFeedback({ type: "err", msg: "Invalid price" }); return; }
        body[patchKey] = value ? num : undefined;
      } else if (patchKey.startsWith("metadata.")) {
        // Metadata fields are stored in the notes JSON blob
        const metaKey = patchKey.split(".")[1];
        const currentMeta = asset.metadata || {};
        const newMeta = { ...currentMeta, [metaKey]: value || undefined };
        body.notes = JSON.stringify(newMeta);
      } else {
        body[patchKey] = value;
      }

      const res = await fetch(`/api/assets/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setFeedback({ type: "err", msg: (json as Record<string, string>).error || "Save failed" });
        return;
      }

      setFeedback({ type: "ok", msg: "Saved" });
      setTimeout(() => setFeedback((f) => f?.msg === "Saved" ? null : f), 2000);

      // Optimistically update parent state
      if (patchKey.startsWith("metadata.")) {
        const metaKey = patchKey.split(".")[1];
        onFieldSaved({ metadata: { ...asset.metadata, [metaKey]: value } });
      } else {
        onFieldSaved({ [patchKey]: patchKey === "purchasePrice" ? parseFloat(value) : value } as Partial<AssetDetail>);
      }
    } catch {
      setFeedback({ type: "err", msg: "Network error" });
    }
  }

  const fields: Array<{ label: string; key: string; value: string; mono?: boolean }> = [
    { label: "Item name", key: "assetTag", value: asset.assetTag },
    { label: "Brand", key: "brand", value: asset.brand },
    { label: "Model", key: "model", value: asset.model },
    { label: "Category", key: "type", value: asset.category?.name || asset.type },
    { label: "Location", key: "_location", value: asset.location.name },
    { label: "Purchase price", key: "purchasePrice", value: asset.purchasePrice ? String(asset.purchasePrice) : "" },
    { label: "Purchase date", key: "purchaseDate", value: asset.purchaseDate ? asset.purchaseDate.slice(0, 10) : "" },
    { label: "Serial number", key: "serialNumber", value: asset.serialNumber, mono: true },
    { label: "Description", key: "metadata.description", value: asset.metadata?.description || "" },
    { label: "Owner", key: "metadata.owner", value: asset.metadata?.owner || "" },
    { label: "Department", key: "metadata.department", value: asset.metadata?.department || "" },
    { label: "UW Asset Tag", key: "metadata.uwAssetTag", value: asset.metadata?.uwAssetTag || "" },
    { label: "Fiscal Year", key: "metadata.fiscalYearPurchased", value: asset.metadata?.fiscalYearPurchased || "" },
  ];

  return (
    <div className="card details-card">
      <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Information</h2>
        {feedback && (
          <span style={{ fontSize: 12, color: feedback.type === "ok" ? "var(--green)" : "var(--red)" }}>
            {feedback.msg}
          </span>
        )}
      </div>
      <dl className="data-list" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
        {fields.map((f) => (
          <EditableField
            key={f.key}
            label={f.label}
            value={f.value}
            canEdit={canEdit && f.key !== "_location"}
            onSave={(v) => saveField(f.key, v)}
            mono={f.mono}
          />
        ))}
      </dl>
    </div>
  );
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
          <EditableInfoCard
            asset={asset}
            canEdit={currentUserRole === "ADMIN" || currentUserRole === "STAFF"}
            onFieldSaved={(partial) => setAsset((prev) => prev ? { ...prev, ...partial } : prev)}
          />

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
