"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import BookingDetailsSheet from "@/components/BookingDetailsSheet";

/* ── Types ─────────────────────────────────────────────── */

type ActiveBookingDetail = {
  id: string;
  kind: string;
  status: string;
  title: string;
  endsAt: string;
  requesterName: string;
};

type UpcomingReservation = {
  bookingId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  requesterName: string;
};

type AssetDetail = {
  id: string;
  assetTag: string;
  name: string | null;
  type: string;
  brand: string;
  model: string;
  serialNumber: string;
  qrCodeValue: string;
  purchaseDate: string | null;
  purchasePrice: string | number | null;
  warrantyDate: string | null;
  residualValue: string | number | null;
  status: string;
  computedStatus: string;
  notes: string | null;
  linkUrl: string | null;
  location: { name: string };
  department: { name: string } | null;
  category: { id: string; name: string } | null;
  availableForReservation: boolean;
  availableForCheckout: boolean;
  availableForCustody: boolean;
  metadata: Record<string, string> | null;
  activeBooking: ActiveBookingDetail | null;
  hasBookingHistory: boolean;
  upcomingReservations: UpcomingReservation[];
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
      sportCode?: string | null;
      requester: { name: string; email: string };
      location: { name: string };
      event?: {
        id: string;
        summary: string;
        sportCode: string | null;
        opponent: string | null;
        isHome: boolean | null;
        startsAt: string;
        endsAt: string;
      } | null;
    };
  }>;
};

type CategoryOption = { id: string; name: string; parentId: string | null };

type TabKey = "info" | "checkouts" | "reservations" | "calendar" | "history" | "settings";

const tabDefs: Array<{ key: TabKey; label: string }> = [
  { key: "info", label: "Info" },
  { key: "checkouts", label: "Check Outs" },
  { key: "reservations", label: "Reservations" },
  { key: "calendar", label: "Calendar" },
  { key: "history", label: "History" },
  { key: "settings", label: "Settings" },
];

/* ── Helpers ────────────────────────────────────────────── */

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function dueBackText(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms < 0) return "Overdue";
  const hours = Math.floor(ms / 3600000);
  if (hours < 24) return `Due back in ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Due back in ${days}d`;
}

function getFiscalYearOptions(): string[] {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  const year = now.getFullYear();
  const currentFY = month >= 6 ? year + 1 : year; // July 1 rollover
  const options: string[] = [];
  for (let fy = currentFY + 1; fy >= currentFY - 10; fy--) {
    options.push(String(fy));
  }
  return options;
}

/* ── Status Line ────────────────────────────────────────── */

function StatusLine({ asset }: { asset: AssetDetail }) {
  const s = asset.computedStatus;
  const b = asset.activeBooking;

  if (s === "AVAILABLE") {
    return <span style={{ color: "var(--green)", fontWeight: 600, fontSize: 14 }}>Available</span>;
  }
  if (s === "CHECKED_OUT" && b) {
    const href = `/checkouts/${b.id}`;
    if (b.status === "DRAFT") {
      return (
        <Link href={href} style={{ color: "var(--blue)", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>
          Checking Out
        </Link>
      );
    }
    return (
      <Link href={href} style={{ color: "var(--red)", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>
        Checked Out by {b.requesterName}
      </Link>
    );
  }
  if (s === "RESERVED" && b) {
    return (
      <Link href={`/reservations/${b.id}`} style={{ color: "var(--purple)", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>
        Reserved by {b.requesterName}
      </Link>
    );
  }
  if (s === "MAINTENANCE") {
    return <span style={{ color: "var(--orange)", fontWeight: 600, fontSize: 14 }}>Needs Maintenance</span>;
  }
  if (s === "RETIRED") {
    return <span style={{ color: "var(--text-muted)", fontWeight: 600, fontSize: 14 }}>Retired</span>;
  }
  return <span style={{ color: "var(--text-secondary)", fontSize: 14 }}>{s}</span>;
}

/* ── Actions Dropdown ───────────────────────────────────── */

function ActionsMenu({
  asset,
  onAction,
}: {
  asset: AssetDetail;
  onAction: (action: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const canDelete = !asset.hasBookingHistory;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="btn" onClick={() => setOpen((v) => !v)}>Actions</button>
      {open && (
        <div className="ctx-menu" style={{ position: "absolute", right: 0, top: "100%", marginTop: 4, zIndex: 60 }}>
          <button className="ctx-menu-item" onClick={() => { setOpen(false); onAction("duplicate"); }}>
            Duplicate
          </button>
          <button className="ctx-menu-item" onClick={() => { setOpen(false); onAction("maintenance"); }}>
            {asset.status === "MAINTENANCE" ? "Clear Maintenance" : "Needs Maintenance"}
          </button>
          <button className="ctx-menu-item" onClick={() => { setOpen(false); onAction("retire"); }}>
            Retire
          </button>
          <div className="ctx-menu-sep" />
          <button
            className="ctx-menu-item danger"
            disabled={!canDelete}
            style={!canDelete ? { opacity: 0.4, cursor: "not-allowed" } : {}}
            title={!canDelete ? "Item has booking history — use Retire instead" : "Permanently delete this item"}
            onClick={() => { if (canDelete) { setOpen(false); onAction("delete"); } }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Editable Field ─────────────────────────────────────── */

function EditableField({
  label, value, placeholder, canEdit, onSave, mono, type,
}: {
  label: string;
  value: string;
  placeholder?: string;
  canEdit: boolean;
  onSave: (v: string) => Promise<void>;
  mono?: boolean;
  type?: "text" | "select";
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

  const isEmpty = !value;
  const displayText = isEmpty && placeholder ? placeholder : (value || "—");
  const displayStyle = isEmpty && placeholder
    ? { color: "var(--text-muted)", fontStyle: "italic" as const, cursor: canEdit ? "pointer" : "default" }
    : { cursor: canEdit ? "pointer" : "default", borderBottom: canEdit ? "1px dashed var(--border)" : "none", padding: "0 2px" };

  return (
    <div className="data-list-row">
      <dt className="data-list-label">{label}</dt>
      <dd className="data-list-value" style={mono ? { fontFamily: "monospace" } : undefined}>
        {editing && type !== "select" ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
            disabled={saving}
            style={{ width: "100%", padding: "2px 6px", border: "1px solid var(--border)", borderRadius: 4, fontSize: 13, fontFamily: mono ? "monospace" : "inherit", textAlign: "right", outline: "none" }}
          />
        ) : (
          <span onClick={() => canEdit && setEditing(true)} style={displayStyle} title={canEdit ? "Click to edit" : undefined}>
            {displayText}
          </span>
        )}
      </dd>
    </div>
  );
}

/* ── Fiscal Year Select Field ───────────────────────────── */

function FiscalYearField({ value, canEdit, onSave }: { value: string; canEdit: boolean; onSave: (v: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const options = getFiscalYearOptions();

  return (
    <div className="data-list-row">
      <dt className="data-list-label">Fiscal Year</dt>
      <dd className="data-list-value">
        {editing ? (
          <select
            value={value}
            onChange={async (e) => { await onSave(e.target.value); setEditing(false); }}
            onBlur={() => setEditing(false)}
            autoFocus
            style={{ padding: "2px 6px", border: "1px solid var(--border)", borderRadius: 4, fontSize: 13, textAlign: "right", outline: "none" }}
          >
            <option value="">—</option>
            {options.map((fy) => <option key={fy} value={fy}>{fy}</option>)}
          </select>
        ) : (
          <span
            onClick={() => canEdit && setEditing(true)}
            style={!value ? { color: "var(--text-muted)", fontStyle: "italic", cursor: canEdit ? "pointer" : "default" } : { cursor: canEdit ? "pointer" : "default", borderBottom: canEdit ? "1px dashed var(--border)" : "none", padding: "0 2px" }}
          >
            {value || "Add fiscal year"}
          </span>
        )}
      </dd>
    </div>
  );
}

/* ── Category Select Field ──────────────────────────────── */

function CategoryField({ value, canEdit, categories, onSave, onCategoriesChanged }: { value: string; canEdit: boolean; categories: CategoryOption[]; onSave: (id: string) => Promise<void>; onCategoriesChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (creating) inputRef.current?.focus(); }, [creating]);

  async function handleCreateCategory() {
    if (!newCatName.trim()) { setCreating(false); return; }
    setSaving(true);
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCatName.trim() }),
    });
    if (res.ok) {
      const json = await res.json();
      onCategoriesChanged();
      if (json.data?.id) await onSave(json.data.id);
    }
    setSaving(false);
    setCreating(false);
    setNewCatName("");
  }

  return (
    <div className="data-list-row">
      <dt className="data-list-label">Category</dt>
      <dd className="data-list-value">
        {creating ? (
          <div style={{ display: "flex", gap: 4 }}>
            <input
              ref={inputRef}
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="Category name"
              disabled={saving}
              onBlur={handleCreateCategory}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateCategory();
                if (e.key === "Escape") { setCreating(false); setNewCatName(""); }
              }}
              style={{ width: 140, padding: "2px 6px", border: "1px solid var(--border)", borderRadius: 4, fontSize: 13, outline: "none" }}
            />
          </div>
        ) : editing ? (
          <select
            defaultValue=""
            onChange={async (e) => {
              if (e.target.value === "__create__") { setEditing(false); setCreating(true); return; }
              await onSave(e.target.value); setEditing(false);
            }}
            onBlur={() => setEditing(false)}
            autoFocus
            style={{ padding: "2px 6px", border: "1px solid var(--border)", borderRadius: 4, fontSize: 13, textAlign: "right", outline: "none" }}
          >
            <option value="">—</option>
            {categories.filter((c) => !c.parentId).map((parent) => (
              <optgroup key={parent.id} label={parent.name}>
                {categories.filter((c) => c.parentId === parent.id).length === 0
                  ? <option value={parent.id}>{parent.name}</option>
                  : categories.filter((c) => c.parentId === parent.id).map((child) => (
                    <option key={child.id} value={child.id}>{child.name}</option>
                  ))
                }
              </optgroup>
            ))}
            <option value="__create__">+ Create new category</option>
          </select>
        ) : (
          <span
            onClick={() => canEdit && setEditing(true)}
            style={!value ? { color: "var(--text-muted)", fontStyle: "italic", cursor: canEdit ? "pointer" : "default" } : { cursor: canEdit ? "pointer" : "default", borderBottom: canEdit ? "1px dashed var(--border)" : "none", padding: "0 2px" }}
          >
            {value || "Add category"}
          </span>
        )}
      </dd>
    </div>
  );
}

/* ── QR Code Visual ─────────────────────────────────────── */

function QRCodeImage({ value }: { value: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!value || !canvasRef.current) return;
    setLoaded(false);
    import("qrcode").then((QRCode) => {
      if (!canvasRef.current) return;
      QRCode.toCanvas(canvasRef.current, value, { width: 120, margin: 2 }, () => {
        setLoaded(true);
      });
    });
  }, [value]);

  if (!value) return null;
  return (
    <canvas
      ref={canvasRef}
      style={{ display: "block", borderRadius: 6, border: "1px solid var(--border-light)", opacity: loaded ? 1 : 0 }}
    />
  );
}

/* ── QR Code Section ────────────────────────────────────── */

function QRSection({ asset, canEdit, onRefresh }: { asset: AssetDetail; canEdit: boolean; onRefresh: () => void }) {
  const [manualEntry, setManualEntry] = useState(false);
  const [qrDraft, setQrDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function generateQR() {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/assets/${asset.id}/generate-qr`, { method: "POST" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError((json as Record<string, string>).error || "Failed");
    }
    setSaving(false);
    onRefresh();
  }

  async function saveManualQR() {
    if (!qrDraft.trim()) { setManualEntry(false); return; }
    setSaving(true);
    setError("");
    const res = await fetch(`/api/assets/${asset.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qrCodeValue: qrDraft.trim() }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError((json as Record<string, string>).error || "Failed");
      setSaving(false);
      return;
    }
    setSaving(false);
    setManualEntry(false);
    onRefresh();
  }

  return (
    <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-light)" }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>TRACKING CODES</div>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 8 }}>
        <QRCodeImage value={asset.qrCodeValue} />
        <div style={{ flex: 1 }}>
          <div className="tracking-row" style={{ marginBottom: 8 }}>
            <span>QR</span>
            <strong style={{ fontFamily: "monospace" }}>{asset.qrCodeValue}</strong>
          </div>
          <div className="tracking-row">
            <span>Serial</span>
            <strong style={{ fontFamily: "monospace" }}>{asset.serialNumber}</strong>
          </div>
        </div>
      </div>
      {canEdit && (
        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-sm" onClick={generateQR} disabled={saving}>
            {saving ? "..." : "Generate new QR"}
          </button>
          <button className="btn btn-sm" onClick={() => setManualEntry(true)}>
            Enter QR manually
          </button>
        </div>
      )}
      {manualEntry && (
        <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
          <input
            value={qrDraft}
            onChange={(e) => setQrDraft(e.target.value)}
            placeholder="Enter QR code..."
            style={{ flex: 1, padding: "4px 8px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13 }}
            onKeyDown={(e) => { if (e.key === "Enter") saveManualQR(); if (e.key === "Escape") setManualEntry(false); }}
            autoFocus
          />
          <button className="btn btn-sm btn-primary" onClick={saveManualQR} disabled={saving}>Save</button>
          <button className="btn btn-sm" onClick={() => setManualEntry(false)}>Cancel</button>
        </div>
      )}
      {error && <div style={{ color: "var(--red)", fontSize: 12, marginTop: 6 }}>{error}</div>}
    </div>
  );
}

/* ── Info Tab: Item Information Card ────────────────────── */

function ItemInfoCard({
  asset, canEdit, categories, onFieldSaved, onRefresh, onCategoriesChanged,
}: {
  asset: AssetDetail;
  canEdit: boolean;
  categories: CategoryOption[];
  onFieldSaved: (updated: Partial<AssetDetail>) => void;
  onRefresh: () => void;
  onCategoriesChanged: () => void;
}) {
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  async function saveField(patchKey: string, value: string) {
    setFeedback(null);
    try {
      const body: Record<string, unknown> = {};
      if (patchKey === "purchasePrice" || patchKey === "residualValue") {
        const num = parseFloat(value);
        if (value && isNaN(num)) { setFeedback({ type: "err", msg: "Invalid number" }); return; }
        body[patchKey] = value ? num : undefined;
      } else if (patchKey.startsWith("metadata.")) {
        const metaKey = patchKey.split(".")[1];
        const currentMeta = asset.metadata || {};
        const newMeta = { ...currentMeta, [metaKey]: value || undefined };
        body.notes = JSON.stringify(newMeta);
      } else {
        body[patchKey] = value || null;
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

  async function saveCategory(categoryId: string) {
    setFeedback(null);
    const res = await fetch(`/api/assets/${asset.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId: categoryId || null }),
    });
    if (res.ok) {
      setFeedback({ type: "ok", msg: "Saved" });
      setTimeout(() => setFeedback((f) => f?.msg === "Saved" ? null : f), 2000);
      onRefresh();
    }
  }

  type FieldDef = { label: string; key: string; value: string; placeholder?: string; mono?: boolean };

  const identityFields: FieldDef[] = [
    { label: "Asset tag", key: "assetTag", value: asset.assetTag },
    { label: "Item name", key: "name", value: asset.name || "", placeholder: "Add item name" },
    { label: "Brand", key: "brand", value: asset.brand, placeholder: "Add brand" },
    { label: "Model", key: "model", value: asset.model, placeholder: "Add model" },
    { label: "Serial number", key: "serialNumber", value: asset.serialNumber, mono: true },
    { label: "Description", key: "metadata.description", value: asset.metadata?.description || "", placeholder: "Add description" },
  ];

  const procurementFields: FieldDef[] = [
    { label: "Purchase price", key: "purchasePrice", value: asset.purchasePrice ? String(asset.purchasePrice) : "", placeholder: "Add purchase price" },
    { label: "Purchase date", key: "purchaseDate", value: asset.purchaseDate ? asset.purchaseDate.slice(0, 10) : "", placeholder: "Add purchase date" },
    { label: "Residual value", key: "residualValue", value: asset.residualValue ? String(asset.residualValue) : "", placeholder: "Add residual value" },
    { label: "Warranty date", key: "warrantyDate", value: asset.warrantyDate ? String(asset.warrantyDate).slice(0, 10) : "", placeholder: "Add warranty date" },
    { label: "Link", key: "linkUrl", value: asset.linkUrl || "", placeholder: "Add product link" },
  ];

  const adminFields: FieldDef[] = [
    { label: "Location", key: "_location", value: asset.location.name },
    { label: "Owner", key: "metadata.owner", value: asset.metadata?.owner || "", placeholder: "Add owner" },
    { label: "Department", key: "metadata.department", value: asset.metadata?.department || "", placeholder: "Add department" },
    { label: "UW Asset Tag", key: "metadata.uwAssetTag", value: asset.metadata?.uwAssetTag || "", placeholder: "Add UW asset tag" },
  ];

  function renderFieldGroup(title: string, fields: FieldDef[], extra?: React.ReactNode) {
    return (
      <>
        <div style={{ gridColumn: "1 / -1", fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.05em", color: "var(--text-muted)", padding: "10px 16px 2px", borderTop: "1px solid var(--border-light)" }}>
          {title}
        </div>
        {fields.map((f) => (
          <EditableField
            key={f.key}
            label={f.label}
            value={f.value}
            placeholder={f.placeholder}
            canEdit={canEdit && f.key !== "_location"}
            onSave={(v) => saveField(f.key, v)}
            mono={f.mono}
          />
        ))}
        {extra}
      </>
    );
  }

  return (
    <div className="card details-card">
      <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Item Information</h2>
        {feedback && (
          <span style={{ fontSize: 12, color: feedback.type === "ok" ? "var(--green)" : "var(--red)" }}>
            {feedback.msg}
          </span>
        )}
      </div>
      <dl className="data-list" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
        {renderFieldGroup("Identity", identityFields)}
        {renderFieldGroup("Procurement", procurementFields, (
          <FiscalYearField
            value={asset.metadata?.fiscalYearPurchased || ""}
            canEdit={canEdit}
            onSave={(v) => saveField("metadata.fiscalYearPurchased", v)}
          />
        ))}
        {renderFieldGroup("Administrative", adminFields, (
          <CategoryField
            value={asset.category?.name || ""}
            canEdit={canEdit}
            categories={categories}
            onSave={saveCategory}
            onCategoriesChanged={onCategoriesChanged}
          />
        ))}
      </dl>
      <QRSection asset={asset} canEdit={canEdit} onRefresh={onRefresh} />
    </div>
  );
}

/* ── Info Tab: Operational Overview ─────────────────────── */

function OperationalOverview({ asset, onSelectBooking }: { asset: AssetDetail; onSelectBooking: (id: string) => void }) {
  const b = asset.activeBooking;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Active Checkout Card */}
      <div className="card">
        <div className="card-header"><h2>Active Check-out</h2></div>
        <div style={{ padding: 16 }}>
          {b && b.kind === "CHECKOUT" ? (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <strong>{b.title}</strong>
                <span className="badge badge-orange" style={{ fontSize: 11 }}>{dueBackText(b.endsAt)}</span>
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>
                Held by <strong>{b.requesterName}</strong>
              </div>
              <button className="btn btn-sm" onClick={() => onSelectBooking(b.id)}>
                View checkout &rarr;
              </button>
            </div>
          ) : (
            <div className="empty-state" style={{ padding: "16px 0" }}>No active check-out</div>
          )}
        </div>
      </div>

      {/* Upcoming Reservations */}
      <div className="card">
        <div className="card-header"><h2>Upcoming Reservations</h2></div>
        <div style={{ padding: 16 }}>
          {asset.upcomingReservations.length === 0 ? (
            <div className="empty-state" style={{ padding: "16px 0" }}>No upcoming reservations</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {asset.upcomingReservations.map((r) => (
                <div
                  key={r.bookingId}
                  className="event-row"
                  style={{ cursor: "pointer" }}
                  onClick={() => onSelectBooking(r.bookingId)}
                >
                  <div className="event-row-main">
                    <div className="event-row-title">{r.title}</div>
                    <div className="event-row-meta">
                      {formatDate(r.startsAt)} – {formatDate(r.endsAt)} &middot; {r.requesterName}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Booking Kind Tab ───────────────────────────────────── */

function BookingKindTab({
  kind, groups, asset, onSelectBooking,
}: {
  kind: "CHECKOUT" | "RESERVATION";
  groups: Array<{ month: string; items: AssetDetail["history"] }>;
  asset: AssetDetail;
  onSelectBooking: (id: string) => void;
}) {
  const label = kind === "CHECKOUT" ? "check-outs" : "reservations";
  const filtered = groups
    .map((g) => ({ month: g.month, items: g.items.filter((e) => e.booking.kind === kind) }))
    .filter((g) => g.items.length > 0);

  const activeBooking = asset.activeBooking;
  const showActiveCard = kind === "CHECKOUT" && activeBooking && activeBooking.kind === "CHECKOUT";
  const showUpcoming = kind === "RESERVATION" && asset.upcomingReservations.length > 0;

  return (
    <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
      {/* Active checkout card at top of Check Outs tab */}
      {showActiveCard && activeBooking && (
        <div className="card">
          <div className="card-header"><h2>Active Check-out</h2></div>
          <div style={{ padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <strong>{activeBooking.title}</strong>
              <span className="badge badge-orange" style={{ fontSize: 11 }}>{dueBackText(activeBooking.endsAt)}</span>
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>
              Held by <strong>{activeBooking.requesterName}</strong>
            </div>
            <button className="btn btn-sm" onClick={() => onSelectBooking(activeBooking.id)}>
              View checkout &rarr;
            </button>
          </div>
        </div>
      )}

      {/* Upcoming reservations at top of Reservations tab */}
      {showUpcoming && (
        <div className="card">
          <div className="card-header"><h2>Upcoming Reservations</h2></div>
          <div style={{ padding: 16 }}>
            <div style={{ display: "grid", gap: 10 }}>
              {asset.upcomingReservations.map((r) => (
                <div key={r.bookingId} className="event-row" style={{ cursor: "pointer" }} onClick={() => onSelectBooking(r.bookingId)}>
                  <div className="event-row-main">
                    <div className="event-row-title">{r.title}</div>
                    <div className="event-row-meta">
                      {formatDate(r.startsAt)} – {formatDate(r.endsAt)} &middot; {r.requesterName}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* History table */}
      <div className="card">
        <div className="card-header"><h2>{kind === "CHECKOUT" ? "Check-out" : "Reservation"} History</h2></div>
        <div style={{ padding: 16 }}>
          {filtered.length === 0 ? (
            <div className="empty-state">No {label} yet for this item.</div>
          ) : (
            filtered.map((group) => (
              <div key={group.month} style={{ marginBottom: 16 }}>
                <h3 style={{ margin: "0 0 8px", fontSize: 18 }}>{group.month}</h3>
                <table className="data-table">
                  <thead><tr><th>Booking</th><th>Requester</th><th>When</th><th>Location</th></tr></thead>
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
    </div>
  );
}

/* ── Calendar Tab ───────────────────────────────────────── */

function CalendarTab({ asset, onSelectBooking }: { asset: AssetDetail; onSelectBooking: (id: string) => void }) {
  const allBookings = asset.history
    .map((e) => e.booking)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  // Separate bookings with events and without
  const eventBookings = allBookings.filter((b) => b.event);
  const standaloneBookings = allBookings.filter((b) => !b.event);

  return (
    <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
      {/* Event-linked bookings */}
      <div className="card">
        <div className="card-header"><h2>Event-linked Bookings</h2></div>
        <div style={{ padding: 16 }}>
          {eventBookings.length === 0 ? (
            <div className="empty-state">No event-linked bookings for this item.</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {eventBookings.map((b) => (
                <div
                  key={b.id}
                  className="event-row"
                  style={{ cursor: "pointer" }}
                  onClick={() => onSelectBooking(b.id)}
                >
                  <span className={`badge ${b.kind === "CHECKOUT" ? "badge-blue" : "badge-purple"}`} style={{ fontSize: 10, flexShrink: 0 }}>
                    {b.kind === "CHECKOUT" ? "CO" : "RES"}
                  </span>
                  <div className="event-row-main">
                    <div className="event-row-title">
                      {b.title}
                      {b.sportCode && <span className="badge-sport" style={{ marginLeft: 6 }}>{b.sportCode}</span>}
                    </div>
                    <div className="event-row-meta">
                      {b.event && (
                        <span style={{ fontWeight: 500 }}>
                          {b.event.opponent
                            ? `${b.event.isHome ? "vs" : "at"} ${b.event.opponent}`
                            : b.event.summary}
                          {" · "}
                        </span>
                      )}
                      {formatDate(b.startsAt)} – {formatDate(b.endsAt)} &middot; {b.requester.name}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Standalone bookings */}
      {standaloneBookings.length > 0 && (
        <div className="card">
          <div className="card-header"><h2>Other Bookings</h2></div>
          <div style={{ padding: 16 }}>
            <div style={{ display: "grid", gap: 8 }}>
              {standaloneBookings.map((b) => (
                <div
                  key={b.id}
                  className="event-row"
                  style={{ cursor: "pointer" }}
                  onClick={() => onSelectBooking(b.id)}
                >
                  <span className={`badge ${b.kind === "CHECKOUT" ? "badge-blue" : "badge-purple"}`} style={{ fontSize: 10, flexShrink: 0 }}>
                    {b.kind === "CHECKOUT" ? "CO" : "RES"}
                  </span>
                  <div className="event-row-main">
                    <div className="event-row-title">{b.title}</div>
                    <div className="event-row-meta">
                      {formatDate(b.startsAt)} – {formatDate(b.endsAt)} &middot; {b.requester.name}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {allBookings.length === 0 && (
        <div className="card">
          <div className="card-header"><h2>Calendar</h2></div>
          <div style={{ padding: 16 }}>
            <div className="empty-state">No bookings for this item.</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Activity Feed (History Tab) ────────────────────────── */

type AuditEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeJson: Record<string, unknown> | null;
  afterJson: Record<string, unknown> | null;
  createdAt: string;
  actor: { name: string; email: string } | null;
};

const ACTION_LABELS: Record<string, string> = {
  created: "Created this item",
  updated: "Updated item details",
  deleted: "Deleted this item",
  retired: "Retired this item",
  marked_maintenance: "Marked as needs maintenance",
  cleared_maintenance: "Cleared maintenance status",
  duplicated: "Duplicated this item",
  qr_generated: "Generated new QR code",
  // Booking actions
  "booking.created": "Created a booking",
  cancelled: "Cancelled booking",
  cancelled_by_checkout_conversion: "Reservation converted to checkout",
  items_returned: "All items returned",
  items_returned_partial: "Some items returned",
  checkout_completed: "Checkout completed",
  extended: "Extended checkout",
  partial_return_recorded: "Partial return recorded",
  checkout_scan_completed: "Checkout scan completed",
  scan_completed: "Scan completed",
  admin_override: "Admin override",
};

function describeFieldChange(key: string, before: unknown, after: unknown): string {
  const labels: Record<string, string> = {
    name: "Item name", brand: "Brand", model: "Model", assetTag: "Asset tag",
    serialNumber: "Serial number", status: "Status", purchasePrice: "Purchase price",
    purchaseDate: "Purchase date", warrantyDate: "Warranty date", residualValue: "Residual value",
    linkUrl: "Link", notes: "Notes", categoryId: "Category", qrCodeValue: "QR code",
    availableForReservation: "Reservation availability", availableForCheckout: "Checkout availability",
    availableForCustody: "Custody availability",
  };
  const label = labels[key] || key;
  const from = before == null || before === "" ? "empty" : String(before);
  const to = after == null || after === "" ? "empty" : String(after);
  return `${label}: ${from} \u2192 ${to}`;
}

function ActivityFeed({ assetId }: { assetId: string }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/assets/${assetId}/activity`)
      .then((res) => res.ok ? res.json() : null)
      .then((json) => { if (json?.data) setEntries(json.data); })
      .finally(() => setLoading(false));
  }, [assetId]);

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  if (entries.length === 0) {
    return <div className="empty-state">No activity recorded yet.</div>;
  }

  return (
    <div className="history-feed">
      {entries.map((entry) => {
        const actorName = entry.actor?.name || "System";
        const initial = actorName.slice(0, 1).toUpperCase();
        const actionLabel = ACTION_LABELS[entry.action] || entry.action;
        const isUpdate = entry.action === "updated" && entry.beforeJson && entry.afterJson;
        const changes = isUpdate
          ? Object.keys(entry.afterJson!).filter((k) => {
              const b = (entry.beforeJson as Record<string, unknown>)?.[k];
              const a = (entry.afterJson as Record<string, unknown>)?.[k];
              return String(b ?? "") !== String(a ?? "");
            })
          : [];

        return (
          <div className="history-row" key={entry.id}>
            <div className="history-dot" style={entry.entityType === "booking" ? { background: "var(--blue, #3b82f6)", color: "#fff" } : undefined}>
              {initial}
            </div>
            <div>
              <div>
                <strong>{actorName}</strong>{" "}
                {entry.entityType === "booking" ? (
                  <span>
                    {actionLabel}
                    {entry.afterJson && typeof entry.afterJson === "object" && "title" in entry.afterJson && (
                      <> &mdash; <em>{String(entry.afterJson.title)}</em></>
                    )}
                  </span>
                ) : (
                  <span>{actionLabel}</span>
                )}
              </div>
              {isUpdate && changes.length > 0 && (
                <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-secondary)" }}>
                  {changes.map((key) => (
                    <div key={key} style={{ padding: "1px 0" }}>
                      {describeFieldChange(
                        key,
                        (entry.beforeJson as Record<string, unknown>)?.[key],
                        (entry.afterJson as Record<string, unknown>)?.[key],
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="muted" style={{ marginTop: 2 }}>{formatDateTime(entry.createdAt)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Settings Tab ───────────────────────────────────────── */

function SettingsTab({ asset, canEdit, onRefresh }: { asset: AssetDetail; canEdit: boolean; onRefresh: () => void }) {
  const [saving, setSaving] = useState(false);

  async function toggleSetting(field: string, currentValue: boolean) {
    setSaving(true);
    await fetch(`/api/assets/${asset.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: !currentValue }),
    });
    setSaving(false);
    onRefresh();
  }

  const toggles = [
    { field: "availableForReservation", label: "Available for reservation", value: asset.availableForReservation, help: "When enabled, this item can be included in reservations." },
    { field: "availableForCheckout", label: "Available for check out", value: asset.availableForCheckout, help: "When enabled, this item can be checked out to users." },
    { field: "availableForCustody", label: "Available for custody", value: asset.availableForCustody, help: "When enabled, this item can be taken into custody by a user." },
  ];

  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div className="card-header"><h2>Policy Settings</h2></div>
      <div style={{ padding: 16 }}>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 0, marginBottom: 16 }}>
          These settings control whether this item is eligible for certain operations. They do not reflect the current real-time status.
        </p>
        {toggles.map((t) => (
          <div key={t.field} className="toggle-row" style={{ marginBottom: 16 }}>
            <button
              className={`toggle${t.value ? " on" : ""}`}
              onClick={() => canEdit && toggleSetting(t.field, t.value)}
              disabled={saving || !canEdit}
            />
            <div>
              <div className="toggle-label">{t.label}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{t.help}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────── */

export default function ItemDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("info");
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>("");
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [fetchError, setFetchError] = useState(false);

  function loadAsset() {
    fetch(`/api/assets/${id}`)
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((json) => { if (json?.data) setAsset(json.data); else setFetchError(true); })
      .catch(() => setFetchError(true));
  }

  function loadCategories() {
    fetch("/api/categories")
      .then((res) => res.ok ? res.json() : null)
      .then((json) => { if (json) setCategories(json.data || []); });
  }

  useEffect(() => {
    loadAsset();
    fetch("/api/me")
      .then((res) => res.ok ? res.json() : null)
      .then((json) => { if (json?.user?.role) setCurrentUserRole(json.user.role); });
    loadCategories();
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

  const canEdit = currentUserRole === "ADMIN" || currentUserRole === "STAFF";

  async function handleAction(action: string) {
    if (!asset) return;
    if (action === "duplicate") {
      const res = await fetch(`/api/assets/${asset.id}/duplicate`, { method: "POST" });
      if (res.ok) {
        const json = await res.json();
        router.push(`/items/${json.data.id}`);
      }
    } else if (action === "retire") {
      if (!confirm("Retire this item? It will no longer be available for bookings.")) return;
      await fetch(`/api/assets/${asset.id}/retire`, { method: "POST" });
      loadAsset();
    } else if (action === "maintenance") {
      await fetch(`/api/assets/${asset.id}/maintenance`, { method: "POST" });
      loadAsset();
    } else if (action === "delete") {
      if (!confirm("Permanently delete this item? This cannot be undone.")) return;
      const res = await fetch(`/api/assets/${asset.id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/items");
      } else {
        const json = await res.json().catch(() => ({}));
        alert((json as Record<string, string>).error || "Delete failed");
      }
    }
  }

  if (fetchError) {
    return <div className="empty-state">Item not found or failed to load. <Link href="/items">Back to items</Link></div>;
  }

  if (!asset) {
    return <div className="loading-spinner"><div className="spinner" /></div>;
  }

  return (
    <>
      <div className="breadcrumb"><Link href="/items">Items</Link> <span>&rsaquo;</span> {asset.assetTag}</div>
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 style={{ marginBottom: 0 }}>{asset.assetTag}</h1>
          {asset.name && (
            <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 2 }}>{asset.name}</div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {canEdit && <ActionsMenu asset={asset} onAction={handleAction} />}
          <Link href={`/reservations?newFor=${asset.id}`} className="btn btn-primary" style={{ textDecoration: "none" }}>Reserve</Link>
          <Link href={`/checkouts?newFor=${asset.id}`} className="btn btn-primary" style={{ textDecoration: "none" }}>Check out</Link>
        </div>
      </div>

      {/* Status line */}
      <div style={{ marginBottom: 18, marginTop: 6 }}>
        <StatusLine asset={asset} />
      </div>

      {/* Tabs */}
      <div className="item-tabs">
        {tabDefs.map((tab) => (
          <button
            key={tab.key}
            className={`item-tab ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Info tab — dashboard layout */}
      {activeTab === "info" && (
        <div className="details-grid" style={{ marginTop: 14 }}>
          <ItemInfoCard
            asset={asset}
            canEdit={canEdit}
            categories={categories}
            onFieldSaved={(partial) => setAsset((prev) => prev ? { ...prev, ...partial } : prev)}
            onRefresh={loadAsset}
            onCategoriesChanged={loadCategories}
          />
          <OperationalOverview asset={asset} onSelectBooking={setSelectedBookingId} />
        </div>
      )}

      {/* Check-outs / Reservations tabs */}
      {(activeTab === "checkouts" || activeTab === "reservations") && (
        <BookingKindTab
          kind={activeTab === "checkouts" ? "CHECKOUT" : "RESERVATION"}
          groups={historyByMonth}
          asset={asset}
          onSelectBooking={setSelectedBookingId}
        />
      )}

      {/* Calendar tab */}
      {activeTab === "calendar" && (
        <CalendarTab asset={asset} onSelectBooking={setSelectedBookingId} />
      )}

      {/* History tab — full activity feed from audit log */}
      {activeTab === "history" && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="card-header"><h2>Activity Log</h2></div>
          <div style={{ padding: 16 }}>
            <ActivityFeed assetId={asset.id} />
          </div>
        </div>
      )}

      {/* Settings tab */}
      {activeTab === "settings" && (
        <SettingsTab asset={asset} canEdit={canEdit} onRefresh={loadAsset} />
      )}

      <BookingDetailsSheet
        bookingId={selectedBookingId}
        onClose={() => setSelectedBookingId(null)}
        currentUserRole={currentUserRole}
      />
    </>
  );
}
