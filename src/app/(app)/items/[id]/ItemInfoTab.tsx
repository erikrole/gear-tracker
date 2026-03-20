"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AssetDetail, CategoryOption } from "./types";

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
    try {
      await onSave(trimmed);
      setEditing(false);
    } catch {
      setDraft(value);
      setEditing(false);
    }
    setSaving(false);
  }

  const isEmpty = !value;
  const displayText = isEmpty && placeholder ? placeholder : (value || "\u2014");
  const displayStyle = isEmpty && placeholder
    ? { color: "var(--text-muted)", fontStyle: "italic" as const, cursor: canEdit ? "pointer" : "default" }
    : { cursor: canEdit ? "pointer" : "default", borderBottom: canEdit ? "1px dashed var(--border)" : "none", padding: "0 2px" };

  return (
    <div className="data-list-row">
      <dt className="data-list-label">{label}</dt>
      <dd className={`data-list-value${mono ? " font-mono" : ""}`}>
        {editing && type !== "select" ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
            disabled={saving}
            className={`inline-edit-input${mono ? " font-mono" : ""}`}
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
          <Select
            value={value}
            onValueChange={async (v) => { await onSave(v); setEditing(false); }}
            open={editing}
            onOpenChange={(open) => { if (!open) setEditing(false); }}
          >
            <SelectTrigger size="sm">
              <SelectValue placeholder={"\u2014"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{"\u2014"}</SelectItem>
              {options.map((fy) => <SelectItem key={fy} value={fy}>{fy}</SelectItem>)}
            </SelectContent>
          </Select>
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
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (creating) inputRef.current?.focus(); }, [creating]);

  async function handleCreateCategory() {
    if (!newCatName.trim()) { setCreating(false); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCatName.trim() }),
      });
      if (res.ok) {
        const json = await res.json();
        onCategoriesChanged();
        if (json.data?.id) await onSave(json.data.id);
      } else {
        const json = await res.json().catch(() => ({}));
        toast((json as Record<string, string>).error || "Failed to create category", "error");
      }
    } catch {
      toast("Failed to create category \u2014 check your connection", "error");
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
          <div className="flex gap-4">
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
              className="inline-edit-narrow"
            />
          </div>
        ) : editing ? (
          <Select
            defaultValue={currentId}
            onValueChange={async (v) => {
              if (v === "__create__") { setEditing(false); setCreating(true); return; }
              await onSave(v); setEditing(false);
            }}
            open={editing}
            onOpenChange={(open) => { if (!open) setEditing(false); }}
          >
            <SelectTrigger size="sm">
              <SelectValue placeholder={"\u2014"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{"\u2014"}</SelectItem>
              {categories.filter((c) => !c.parentId).map((parent) => (
                <SelectGroup key={parent.id}>
                  <SelectLabel>{parent.name}</SelectLabel>
                  {categories.filter((c) => c.parentId === parent.id).length === 0
                    ? <SelectItem value={parent.id}>{parent.name}</SelectItem>
                    : categories.filter((c) => c.parentId === parent.id).map((child) => (
                      <SelectItem key={child.id} value={child.id}>{child.name}</SelectItem>
                    ))
                  }
                </SelectGroup>
              ))}
              <SelectItem value="__create__">+ Create new category</SelectItem>
            </SelectContent>
          </Select>
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
      className="qr-canvas"
      style={{ opacity: loaded ? 1 : 0 }}
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
          <h2 className="m-0">QR Code</h2>
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </div>
        <div className="flex-center mb-16 justify-center">
          <QRCodeCanvas value={asset.qrCodeValue} size={240} />
        </div>
        <div className="font-semibold font-mono mb-16 text-center text-base">
          {asset.qrCodeValue}
        </div>
        {canEdit && (
          <>
            <div className="flex gap-8 mb-8 justify-center">
              <Button variant="outline" onClick={generateQR} disabled={saving}>
                {saving ? "..." : "Generate new QR"}
              </Button>
              <Button variant="outline" onClick={() => setManualEntry(true)}>
                Enter QR manually
              </Button>
            </div>
            {manualEntry && (
              <div className="flex gap-6 mt-8">
                <Input
                  value={qrDraft}
                  onChange={(e) => setQrDraft(e.target.value)}
                  placeholder="Paste or type QR code..."
                  className="flex-1"
                  onKeyDown={(e) => { if (e.key === "Enter") saveManualQR(); if (e.key === "Escape") setManualEntry(false); }}
                  autoFocus
                />
                <Button onClick={saveManualQR} disabled={saving}>Save</Button>
                <Button variant="outline" onClick={() => setManualEntry(false)}>Cancel</Button>
              </div>
            )}
            {error && <div className="alert-error mt-8 text-center">{error}</div>}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Tracking Codes Section (with asset tag label) ─────── */

function TrackingCodesSection({ asset, canEdit, onRefresh }: { asset: AssetDetail; canEdit: boolean; onRefresh: () => void }) {
  const [showModal, setShowModal] = useState(false);
  // Split asset tag into stacked lines (e.g. "FB FX3 1" -> ["FB", "FX3", "1"])
  const rawParts = asset.assetTag.split(/[\s]+/).filter(Boolean);
  // Football tags have 3 natural parts and start with "FB"; all others get padded
  const isFootball = rawParts.length === 3 && rawParts[0] === "FB";
  // Always 3 lines — pad top with empty lines for non-3-part tags
  const tagLines = rawParts.length >= 3
    ? rawParts.slice(0, 3)
    : [...Array(3 - rawParts.length).fill(""), ...rawParts];

  return (
    <>
      <div className="p-16 border-t">
        <div className="text-xs font-semibold text-secondary mb-8 section-label">TRACKING CODES</div>
        <div className="flex gap-12 items-center">
          {/* Asset tag label — matches physical Brother label */}
          <button
            className="asset-tag-label"
            onClick={() => setShowModal(true)}
            title="Click to enlarge QR code"
          >
            <div className={`asset-tag-label-text ${isFootball ? "" : "asset-tag-label-text-left"}`}>
              {tagLines.map((line, i) => (
                <div key={i} className="asset-tag-label-line">{line || "\u00A0"}</div>
              ))}
            </div>
            <div className="asset-tag-label-qr">
              <QRCodeCanvas value={asset.qrCodeValue} size={96} margin={0} />
            </div>
          </button>
          <div className="flex-col gap-6">
            <div className="tracking-pill">
              <span className="tracking-pill-label">QR</span>
              <span className="tracking-pill-value">{asset.qrCodeValue}</span>
            </div>
            {asset.serialNumber && (
              <div className="tracking-pill">
                <span className="tracking-pill-label">Serial</span>
                <span className="tracking-pill-value">{asset.serialNumber}</span>
              </div>
            )}
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

/* ── Item Info Card (tab entry point) ───────────────────── */

export default function ItemInfoCard({
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
  const { toast } = useToast();

  async function saveField(patchKey: string, value: string) {
    try {
      const body: Record<string, unknown> = {};
      if (patchKey === "purchasePrice" || patchKey === "residualValue") {
        const num = parseFloat(value);
        if (value && isNaN(num)) { toast("Invalid number", "error"); return; }
        body[patchKey] = value ? num : null;
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
        toast((json as Record<string, string>).error || "Save failed", "error");
        return;
      }

      toast("Saved", "success");

      if (patchKey.startsWith("metadata.")) {
        const metaKey = patchKey.split(".")[1];
        onFieldSaved({ metadata: { ...asset.metadata, [metaKey]: value } });
      } else {
        onFieldSaved({ [patchKey]: (patchKey === "purchasePrice" || patchKey === "residualValue") ? parseFloat(value) : value } as Partial<AssetDetail>);
      }
    } catch {
      toast("Network error", "error");
    }
  }

  async function saveCategory(categoryId: string) {
    const res = await fetch(`/api/assets/${asset.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId: categoryId || null }),
    });
    if (res.ok) {
      toast("Saved", "success");
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
        <div className="field-group-header">
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
    <Card className="details-card">
      <CardHeader>
        <CardTitle>Item Information</CardTitle>
      </CardHeader>
      <dl className="data-list data-list-2col">
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
    </Card>
  );
}
