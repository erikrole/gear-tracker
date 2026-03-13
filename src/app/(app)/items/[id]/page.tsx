"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BookingDetailsSheet from "@/components/BookingDetailsSheet";
import {
  getUrgency,
  formatCountdown,
  formatDateShort,
  formatDateFull,
  formatDateTime,
} from "@/lib/format";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

/* ── Types ─────────────────────────────────────────────── */

type ActiveBookingDetail = {
  id: string;
  kind: string;
  status: string;
  title: string;
  startsAt: string;
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
    return <span className="status-text status-text-available">Available</span>;
  }
  if (s === "CHECKED_OUT" && b) {
    const href = `/checkouts/${b.id}`;
    if (b.status === "DRAFT") {
      return (
        <Link href={href} className="status-text status-text-checking-out no-underline">
          Checking Out
        </Link>
      );
    }
    return (
      <Link href={href} className="status-text status-text-checked-out no-underline">
        Checked Out by {b.requesterName}
      </Link>
    );
  }
  if (s === "RESERVED" && b) {
    return (
      <Link href={`/reservations/${b.id}`} className="status-text status-text-reserved no-underline">
        Reserved by {b.requesterName}
      </Link>
    );
  }
  if (s === "MAINTENANCE") {
    return <span className="status-text status-text-maintenance">Needs Maintenance</span>;
  }
  if (s === "RETIRED") {
    return <span className="status-text status-text-retired">Retired</span>;
  }
  return <span className="text-secondary text-base">{s}</span>;
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
    <div ref={ref} className="relative">
      <button className="btn" onClick={() => setOpen((v) => !v)}>Actions</button>
      {open && (
        <div className="ctx-menu ctx-menu-anchor">
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

function CategoryField({ value, currentId, canEdit, categories, onSave, onCategoriesChanged }: { value: string; currentId: string; canEdit: boolean; categories: CategoryOption[]; onSave: (id: string) => Promise<void>; onCategoriesChanged: () => void }) {
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
            defaultValue={currentId}
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

function QRCodeCanvas({ value, size, margin = 2 }: { value: string; size: number; margin?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!value || !canvasRef.current) return;
    setLoaded(false);
    import("qrcode").then((QRCode) => {
      if (!canvasRef.current) return;
      QRCode.toCanvas(canvasRef.current, value, { width: size, margin }, () => {
        setLoaded(true);
      });
    });
  }, [value, size, margin]);

  if (!value) return null;
  return (
    <canvas
      ref={canvasRef}
      style={{ display: "block", borderRadius: 6, border: "1px solid var(--border-light)", opacity: loaded ? 1 : 0 }}
    />
  );
}

/* ── QR Modal ──────────────────────────────────────────── */

function QRModal({ asset, canEdit, onRefresh, onClose }: { asset: AssetDetail; canEdit: boolean; onRefresh: () => void; onClose: () => void }) {
  const [manualEntry, setManualEntry] = useState(false);
  const [qrDraft, setQrDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const backdropRef = useRef<HTMLDivElement>(null);

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
    setQrDraft("");
    onRefresh();
  }

  return (
    <div
      ref={backdropRef}
      className="qr-modal-backdrop"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="qr-modal">
        <div className="flex-between mb-16">
          <h2 style={{ margin: 0 }}>QR Code</h2>
          <button className="btn btn-sm" onClick={onClose}>Close</button>
        </div>
        <div className="flex-center mb-16" style={{ justifyContent: "center" }}>
          <QRCodeCanvas value={asset.qrCodeValue} size={240} />
        </div>
        <div className="font-semibold font-mono mb-16" style={{ textAlign: "center", fontSize: 16 }}>
          {asset.qrCodeValue}
        </div>
        {canEdit && (
          <>
            <div className="flex gap-8 mb-8" style={{ justifyContent: "center" }}>
              <button className="btn" onClick={generateQR} disabled={saving}>
                {saving ? "..." : "Generate new QR"}
              </button>
              <button className="btn" onClick={() => setManualEntry(true)}>
                Enter QR manually
              </button>
            </div>
            {manualEntry && (
              <div className="flex gap-6 mt-8">
                <input
                  value={qrDraft}
                  onChange={(e) => setQrDraft(e.target.value)}
                  placeholder="Paste or type QR code..."
                  className="form-input flex-1"
                  onKeyDown={(e) => { if (e.key === "Enter") saveManualQR(); if (e.key === "Escape") setManualEntry(false); }}
                  autoFocus
                />
                <button className="btn btn-primary" onClick={saveManualQR} disabled={saving}>Save</button>
                <button className="btn" onClick={() => setManualEntry(false)}>Cancel</button>
              </div>
            )}
            {error && <div className="alert-error mt-8" style={{ textAlign: "center" }}>{error}</div>}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Tracking Codes Section (with asset tag label) ─────── */

function TrackingCodesSection({ asset, canEdit, onRefresh }: { asset: AssetDetail; canEdit: boolean; onRefresh: () => void }) {
  const [showModal, setShowModal] = useState(false);
  // Split asset tag into stacked lines by spaces (e.g. "FB FX3 1" → ["FB", "FX3", "1"])
  const tagLines = asset.assetTag.split(/[\s]+/).filter(Boolean);

  return (
    <>
      <div className="p-16 border-t">
        <div className="text-xs font-semibold text-secondary mb-8" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>TRACKING CODES</div>
        <div className="flex gap-12" style={{ alignItems: "flex-start" }}>
          {/* Asset tag label replaces standalone QR image */}
          <button
            className="asset-tag-label"
            onClick={() => setShowModal(true)}
            title="Click to enlarge QR code"
          >
            <div className="asset-tag-label-text">
              {tagLines.map((line, i) => (
                <div key={i} className="asset-tag-label-line">{line}</div>
              ))}
            </div>
            <div className="asset-tag-label-qr">
              <QRCodeCanvas value={asset.qrCodeValue} size={80} margin={0} />
            </div>
          </button>
          <div className="flex-col gap-4">
            <div className="tracking-row">
              <span>QR</span>
              <strong className="font-mono">{asset.qrCodeValue}</strong>
            </div>
            <div className="tracking-row">
              <span>Serial</span>
              <strong className="font-mono">{asset.serialNumber}</strong>
            </div>
          </div>
        </div>
      </div>
      {showModal && (
        <QRModal
          asset={asset}
          canEdit={canEdit}
          onRefresh={onRefresh}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

function ItemInfoCard({
  asset, canEdit, currentUserRole, categories, onFieldSaved, onRefresh, onCategoriesChanged,
}: {
  asset: AssetDetail;
  canEdit: boolean;
  currentUserRole: string;
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
      <div className="card-header flex-between">
        <h2>Item Information</h2>
        {feedback && (
          <span className={`text-xs ${feedback.type === "ok" ? "text-green" : "text-red"}`}>
            {feedback.msg}
          </span>
        )}
      </div>
      <dl className="data-list" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
        {renderFieldGroup("Identity", identityFields)}
        {currentUserRole !== "STUDENT" && renderFieldGroup("Procurement", procurementFields, (
          <FiscalYearField
            value={asset.metadata?.fiscalYearPurchased || ""}
            canEdit={canEdit}
            onSave={(v) => saveField("metadata.fiscalYearPurchased", v)}
          />
        ))}
        {renderFieldGroup("Administrative", adminFields, (
          <CategoryField
            value={asset.category?.name || ""}
            currentId={asset.category?.id || ""}
            canEdit={canEdit}
            categories={categories}
            onSave={saveCategory}
            onCategoriesChanged={onCategoriesChanged}
          />
        ))}
      </dl>
      <TrackingCodesSection asset={asset} canEdit={canEdit} onRefresh={onRefresh} />
    </div>
  );
}

/* ── Info Tab: Operational Overview (Dashboard-style cards) ── */

function OperationalOverview({ asset, now, onSelectBooking }: { asset: AssetDetail; now: Date; onSelectBooking: (id: string) => void }) {
  const b = asset.activeBooking;
  const hasActiveBooking = !!b;
  const hasReservations = asset.upcomingReservations.length > 0;

  if (!hasActiveBooking && !hasReservations) {
    return (
      <div className="card">
        <div className="card-header"><h2>Bookings</h2></div>
        <div className="empty-state p-16">No active bookings for this item</div>
      </div>
    );
  }

  const activeLabel = b?.kind === "CHECKOUT" ? "Active Check-out" : "Active Reservation";

  return (
    <div className="flex-col gap-16">
      {/* Active Booking — dashboard-style possession card */}
      {hasActiveBooking && b && (
        <div className="card">
          <div className="card-header"><h2>{activeLabel}</h2></div>
          <div className="card-body card-body-compact">
            <button
              className="possession-card"
              onClick={() => onSelectBooking(b.id)}
            >
              <div className={`countdown-bar countdown-${getUrgency(b.startsAt, b.endsAt, now)}`}>
                {getUrgency(b.startsAt, b.endsAt, now) !== "normal"
                  ? formatCountdown(b.endsAt, now)
                  : `Due ${formatDateShort(b.endsAt)}`}
              </div>
              <div className="possession-card-body">
                <span className="possession-asset-tag">{b.title}</span>
                <span className="possession-asset-name">
                  {b.kind === "CHECKOUT" ? "Held" : "Reserved"} by {b.requesterName}
                </span>
                <span className="ops-row-meta">{formatCountdown(b.endsAt, now)}</span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Upcoming Reservations */}
      {hasReservations && (
        <div className="card">
          <div className="card-header">
            <h2>Upcoming Reservations</h2>
            <span className="section-count">{asset.upcomingReservations.length}</span>
          </div>
          <div className="card-body card-body-compact">
            {asset.upcomingReservations.map((r) => (
              <button
                key={r.bookingId}
                className="ops-row"
                onClick={() => onSelectBooking(r.bookingId)}
              >
                <div className="ops-row-main">
                  <span className="ops-row-title">{r.title}</span>
                  <span className="ops-row-meta">
                    {r.requesterName} {"\u00b7"} {formatDateShort(r.startsAt)} – {formatDateShort(r.endsAt)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Booking Kind Tab ───────────────────────────────────── */

function BookingKindTab({
  kind, groups, asset, now, onSelectBooking,
}: {
  kind: "CHECKOUT" | "RESERVATION";
  groups: Array<{ month: string; items: AssetDetail["history"] }>;
  asset: AssetDetail;
  now: Date;
  onSelectBooking: (id: string) => void;
}) {
  const label = kind === "CHECKOUT" ? "check-outs" : "reservations";
  const filtered = groups
    .map((g) => ({ month: g.month, items: g.items.filter((e) => e.booking.kind === kind) }))
    .filter((g) => g.items.length > 0);

  const activeBooking = asset.activeBooking;
  const showActiveCard = activeBooking && activeBooking.kind === kind;
  const showUpcoming = kind === "RESERVATION" && asset.upcomingReservations.length > 0;

  return (
    <div className="flex-col gap-16 mt-14">
      {/* Active booking card at top of matching tab */}
      {showActiveCard && activeBooking && (
        <div className="card">
          <div className="card-header"><h2>Active {kind === "CHECKOUT" ? "Check-out" : "Reservation"}</h2></div>
          <div className="p-16">
            <div className="flex-between mb-8" style={{ alignItems: "baseline" }}>
              <strong>{activeBooking.title}</strong>
              <span className="badge badge-orange text-xs">{formatCountdown(activeBooking.endsAt, now)}</span>
            </div>
            <div className="text-sm text-secondary mb-8">
              {kind === "CHECKOUT" ? "Held" : "Reserved"} by <strong>{activeBooking.requesterName}</strong>
            </div>
            <button className="btn btn-sm" onClick={() => onSelectBooking(activeBooking.id)}>
              View {kind === "CHECKOUT" ? "checkout" : "reservation"} {"\u2192"}
            </button>
          </div>
        </div>
      )}

      {/* Upcoming reservations at top of Reservations tab */}
      {showUpcoming && (
        <div className="card">
          <div className="card-header"><h2>Upcoming Reservations</h2></div>
          <div className="p-16">
            <div className="flex-col gap-10">
              {asset.upcomingReservations.map((r) => (
                <div key={r.bookingId} className="event-row cursor-pointer" onClick={() => onSelectBooking(r.bookingId)}>
                  <div className="event-row-main">
                    <div className="event-row-title">{r.title}</div>
                    <div className="event-row-meta">
                      {formatDateFull(r.startsAt)} – {formatDateFull(r.endsAt)} {"\u00b7"} {r.requesterName}
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
        <div className="p-16">
          {filtered.length === 0 ? (
            <div className="empty-state">No {label} yet for this item.</div>
          ) : (
            filtered.map((group) => (
              <div key={group.month} className="mb-16">
                <h3 className="text-xl mb-8" style={{ margin: 0 }}>{group.month}</h3>
                <table className="data-table">
                  <thead><tr><th>Booking</th><th>Requester</th><th>When</th><th>Location</th></tr></thead>
                  <tbody>
                    {group.items.map((entry) => (
                      <tr key={entry.id} className="cursor-pointer" onClick={() => onSelectBooking(entry.booking.id)}>
                        <td><span className="row-link">{entry.booking.title}</span></td>
                        <td>{entry.booking.requester.name}</td>
                        <td>{formatDateFull(entry.booking.startsAt)}</td>
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
  const [viewDate, setViewDate] = useState(() => new Date());

  const allBookings = useMemo(
    () => asset.history.map((e) => e.booking),
    [asset.history]
  );

  // Deduplicate bookings by id (same booking can appear multiple times from history)
  const uniqueBookings = useMemo(() => {
    const seen = new Set<string>();
    return allBookings.filter((b) => {
      if (seen.has(b.id)) return false;
      seen.add(b.id);
      return true;
    });
  }, [allBookings]);

  // Build calendar grid for current month
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay(); // 0=Sun
  const daysInMonth = lastDay.getDate();

  const monthLabel = viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Map bookings to days: which bookings overlap each day?
  const dayBookings = useMemo(() => {
    const map = new Map<number, Array<typeof uniqueBookings[0]>>();
    for (let d = 1; d <= daysInMonth; d++) {
      const dayStart = new Date(year, month, d).getTime();
      const dayEnd = new Date(year, month, d + 1).getTime();
      const overlapping = uniqueBookings.filter((b) => {
        const bs = new Date(b.startsAt).getTime();
        const be = new Date(b.endsAt).getTime();
        return bs < dayEnd && be > dayStart;
      });
      if (overlapping.length > 0) map.set(d, overlapping);
    }
    return map;
  }, [uniqueBookings, year, month, daysInMonth]);

  const today = new Date();
  const isToday = (d: number) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;

  function prevMonth() { setViewDate(new Date(year, month - 1, 1)); }
  function nextMonth() { setViewDate(new Date(year, month + 1, 1)); }
  function goToday() { setViewDate(new Date()); }

  // Build grid cells: padding + days
  const cells: Array<{ day: number | null }> = [];
  for (let i = 0; i < startPad; i++) cells.push({ day: null });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d });

  return (
    <div className="mt-14">
      <div className="card">
        <div className="card-header">
          <div className="flex-center gap-8">
            <button className="btn btn-sm" onClick={prevMonth}>&lsaquo;</button>
            <h2 style={{ minWidth: 160, textAlign: "center" }}>{monthLabel}</h2>
            <button className="btn btn-sm" onClick={nextMonth}>{"\u203a"}</button>
          </div>
          <button className="btn btn-sm" onClick={goToday}>Today</button>
        </div>
        <div className="p-16">
          {/* Day headers */}
          <div className="cal-grid">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="cal-header">{d}</div>
            ))}
            {cells.map((cell, i) => (
              <div key={i} className={`cal-cell ${cell.day === null ? "cal-cell-empty" : ""} ${cell.day && isToday(cell.day) ? "cal-cell-today" : ""}`}>
                {cell.day && (
                  <>
                    <span className="cal-day-num">{cell.day}</span>
                    {dayBookings.get(cell.day)?.slice(0, 3).map((b) => (
                      <button
                        key={b.id}
                        className={`cal-booking ${b.kind === "CHECKOUT" ? "cal-booking-co" : "cal-booking-res"}`}
                        onClick={() => onSelectBooking(b.id)}
                        title={`${b.kind === "CHECKOUT" ? "CO" : "RES"}: ${b.title} (${b.requester.name})`}
                      >
                        {b.title}
                      </button>
                    ))}
                    {(dayBookings.get(cell.day)?.length ?? 0) > 3 && (
                      <span className="cal-more">+{(dayBookings.get(cell.day)?.length ?? 0) - 3} more</span>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 12, color: "var(--text-secondary)" }}>
        <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "#3b82f6", marginRight: 4, verticalAlign: "middle" }} />Check-out</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "#8b5cf6", marginRight: 4, verticalAlign: "middle" }} />Reservation</span>
      </div>
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
                <div className="text-xs text-secondary mt-4">
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
    <div className="card mt-14">
      <div className="card-header"><h2>Policy Settings</h2></div>
      <div className="p-16">
        <p className="text-sm text-secondary mb-16" style={{ marginTop: 0 }}>
          These settings control whether this item is eligible for certain operations. They do not reflect the current real-time status.
        </p>
        {toggles.map((t) => (
          <div key={t.field} className="toggle-row mb-16">
            <button
              className={`toggle${t.value ? " on" : ""}`}
              onClick={() => canEdit && toggleSetting(t.field, t.value)}
              disabled={saving || !canEdit}
            />
            <div>
              <div className="toggle-label">{t.label}</div>
              <div className="text-xs text-secondary" style={{ marginTop: 2 }}>{t.help}</div>
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
  const confirmDialog = useConfirm();
  const { toast } = useToast();
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("info");
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>("");
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [fetchError, setFetchError] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const loadAsset = useCallback(() => {
    fetch(`/api/assets/${id}`)
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((json) => { if (json?.data) setAsset(json.data); else setFetchError(true); })
      .catch(() => setFetchError(true));
  }, [id]);

  const loadCategories = useCallback(() => {
    fetch("/api/categories")
      .then((res) => res.ok ? res.json() : null)
      .then((json) => { if (json) setCategories(json.data || []); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadAsset();
    fetch("/api/me")
      .then((res) => res.ok ? res.json() : null)
      .then((json) => { if (json?.user?.role) setCurrentUserRole(json.user.role); })
      .catch(() => {});
    loadCategories();
  }, [loadAsset, loadCategories]);

  // Live countdown tick every 60 seconds + refresh on tab focus
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    function onVisibilityChange() {
      if (document.visibilityState === "visible") setNow(new Date());
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

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

  const [actionBusy, setActionBusy] = useState(false);

  async function handleAction(action: string) {
    if (!asset || actionBusy) return;
    setActionBusy(true);
    try {
      if (action === "duplicate") {
        const res = await fetch(`/api/assets/${asset.id}/duplicate`, { method: "POST" });
        if (res.ok) {
          const json = await res.json();
          router.push(`/items/${json.data.id}`);
        } else {
          const json = await res.json().catch(() => ({}));
          toast((json as Record<string, string>).error || "Duplicate failed", "error");
        }
      } else if (action === "retire") {
        const ok = await confirmDialog({
          title: "Retire item",
          message: "Retire this item? It will no longer be available for bookings.",
          confirmLabel: "Retire",
          variant: "danger",
        });
        if (!ok) { setActionBusy(false); return; }
        const res = await fetch(`/api/assets/${asset.id}/retire`, { method: "POST" });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          toast((json as Record<string, string>).error || "Retire failed", "error");
        }
        loadAsset();
      } else if (action === "maintenance") {
        const res = await fetch(`/api/assets/${asset.id}/maintenance`, { method: "POST" });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          toast((json as Record<string, string>).error || "Action failed", "error");
        }
        loadAsset();
      } else if (action === "delete") {
        const ok = await confirmDialog({
          title: "Delete item",
          message: "Permanently delete this item? This cannot be undone.",
          confirmLabel: "Delete",
          variant: "danger",
        });
        if (!ok) { setActionBusy(false); return; }
        const res = await fetch(`/api/assets/${asset.id}`, { method: "DELETE" });
        if (res.ok) {
          router.push("/items");
        } else {
          const json = await res.json().catch(() => ({}));
          toast((json as Record<string, string>).error || "Delete failed", "error");
        }
      }
    } catch {
      toast("Network error — please try again.", "error");
    }
    setActionBusy(false);
  }

  if (fetchError) {
    return <div className="empty-state">Item not found or failed to load. <Link href="/items">Back to items</Link></div>;
  }

  if (!asset) {
    return <div className="loading-spinner"><div className="spinner" /></div>;
  }

  return (
    <>
      <div className="breadcrumb"><Link href="/items">Items</Link> <span>{"\u203a"}</span> {asset.assetTag}</div>
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <div className="flex gap-12" style={{ alignItems: "baseline" }}>
            <h1 style={{ marginBottom: 0 }}>{asset.assetTag}</h1>
            {asset.metadata?.uwAssetTag && (
              <span className="text-base text-secondary font-medium">
                UW {asset.metadata.uwAssetTag}
              </span>
            )}
          </div>
          {asset.name && (
            <div className="text-base text-secondary" style={{ marginTop: 2 }}>{asset.name}</div>
          )}
        </div>
        <div className="header-actions">
          {canEdit && <ActionsMenu asset={asset} onAction={handleAction} />}
          <Link href={`/reservations?newFor=${asset.id}`} className="btn btn-primary header-action-btn no-underline">Reserve</Link>
          <Link href={`/checkouts?newFor=${asset.id}`} className="btn btn-primary header-action-btn no-underline">Check out</Link>
        </div>
      </div>

      {/* Status line */}
      <div className="mb-16 mt-8">
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
        <div className="details-grid mt-14">
          <ItemInfoCard
            asset={asset}
            canEdit={canEdit}
            currentUserRole={currentUserRole}
            categories={categories}
            onFieldSaved={(partial) => setAsset((prev) => prev ? { ...prev, ...partial } : prev)}
            onRefresh={loadAsset}
            onCategoriesChanged={loadCategories}
          />
          <OperationalOverview asset={asset} now={now} onSelectBooking={setSelectedBookingId} />
        </div>
      )}

      {/* Check-outs / Reservations tabs */}
      {(activeTab === "checkouts" || activeTab === "reservations") && (
        <BookingKindTab
          kind={activeTab === "checkouts" ? "CHECKOUT" : "RESERVATION"}
          groups={historyByMonth}
          asset={asset}
          now={now}
          onSelectBooking={setSelectedBookingId}
        />
      )}

      {/* Calendar tab */}
      {activeTab === "calendar" && (
        <CalendarTab asset={asset} onSelectBooking={setSelectedBookingId} />
      )}

      {/* History tab — full activity feed from audit log */}
      {activeTab === "history" && (
        <div className="card mt-14">
          <div className="card-header"><h2>Activity Log</h2></div>
          <div className="p-16">
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
        onUpdated={loadAsset}
        currentUserRole={currentUserRole}
      />
    </>
  );
}
