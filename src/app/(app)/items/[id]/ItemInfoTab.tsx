"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogCloseButton,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
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
          <Input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
            disabled={saving}
            className={cn("h-8 text-right text-sm", mono && "font-mono")}
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

/* ── Date Picker Field ─────────────────────────────────── */

function DatePickerField({ label, value, placeholder, canEdit, onSave }: { label: string; value: string; placeholder?: string; canEdit: boolean; onSave: (v: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const dateValue = value ? new Date(value + "T00:00:00") : undefined;

  async function handleSelect(day: Date | undefined) {
    if (!day) return;
    const iso = format(day, "yyyy-MM-dd");
    if (iso === value) { setOpen(false); return; }
    setSaving(true);
    try {
      await onSave(iso);
    } catch { /* handled upstream */ }
    setSaving(false);
    setOpen(false);
  }

  async function handleClear() {
    setSaving(true);
    try {
      await onSave("");
    } catch { /* handled upstream */ }
    setSaving(false);
    setOpen(false);
  }

  return (
    <div className="data-list-row">
      <dt className="data-list-label">{label}</dt>
      <dd className="data-list-value">
        {canEdit ? (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                disabled={saving}
                className={cn("h-8 w-auto min-w-[140px] justify-start text-sm font-normal", !value && "text-muted-foreground italic")}
              >
                <CalendarIcon className="mr-2 size-3.5" />
                {value ? format(dateValue!, "MMM d, yyyy") : (placeholder || "Pick a date")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={dateValue}
                onSelect={handleSelect}
                defaultMonth={dateValue}
              />
              {value && (
                <div className="border-t px-3 py-2">
                  <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={handleClear}>
                    Clear date
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        ) : (
          <span>{value ? format(dateValue!, "MMM d, yyyy") : "\u2014"}</span>
        )}
      </dd>
    </div>
  );
}

/* ── Category Select Field ──────────────────────────────── */

function CategoryField({ value, currentId, canEdit, categories, onSave, onCategoriesChanged }: { value: string; currentId: string; canEdit: boolean; categories: CategoryOption[]; onSave: (id: string) => Promise<void>; onCategoriesChanged: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (creating) inputRef.current?.focus(); }, [creating]);

  // Build flat list of selectable categories (children, or parents with no children)
  const selectableCategories = categories.filter((c) => {
    if (c.parentId) return true; // child category — always selectable
    return categories.filter((ch) => ch.parentId === c.id).length === 0; // parent with no children
  });

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
          <div className="flex gap-2">
            <Input
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
              className="h-8 w-[180px] text-sm"
            />
          </div>
        ) : canEdit ? (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="h-8 w-auto min-w-[140px] justify-between text-sm font-normal"
              >
                {value || <span className="text-muted-foreground italic">Add category</span>}
                <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[220px] p-0" align="end">
              <Command>
                <CommandInput placeholder="Search categories..." />
                <CommandList>
                  <CommandEmpty>No category found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value=""
                      onSelect={async () => { await onSave(""); setOpen(false); }}
                    >
                      <Check className={cn("mr-2 size-4", !currentId ? "opacity-100" : "opacity-0")} />
                      <span className="text-muted-foreground">&mdash;</span>
                    </CommandItem>
                    {selectableCategories.map((cat) => {
                      const parentName = cat.parentId
                        ? categories.find((p) => p.id === cat.parentId)?.name
                        : null;
                      return (
                        <CommandItem
                          key={cat.id}
                          value={cat.name}
                          onSelect={async () => { await onSave(cat.id); setOpen(false); }}
                        >
                          <Check className={cn("mr-2 size-4", currentId === cat.id ? "opacity-100" : "opacity-0")} />
                          {parentName ? <span className="text-muted-foreground mr-1">{parentName} /</span> : null}
                          {cat.name}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => { setOpen(false); setCreating(true); }}
                    >
                      + Create new category
                    </CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        ) : (
          <span>{value || "\u2014"}</span>
        )}
      </dd>
    </div>
  );
}

/* ── QR Code Visual ─────────────────────────────────────── */

export function QRCodeCanvas({ value, size, margin = 2 }: { value: string; size: number; margin?: number }) {
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

export function QRModal({ asset, canEdit, onRefresh, open, onOpenChange }: { asset: AssetDetail; canEdit: boolean; onRefresh: () => void; open: boolean; onOpenChange: (open: boolean) => void }) {
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
    setQrDraft("");
    onRefresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle>QR Code</DialogTitle>
          <DialogCloseButton />
        </DialogHeader>
        <DialogBody className="py-6">
          <div className="flex justify-center mb-4">
            <QRCodeCanvas value={asset.qrCodeValue} size={240} />
          </div>
          <div className="font-semibold font-mono text-center text-sm mb-4">
            {asset.qrCodeValue}
          </div>
          {canEdit && (
            <>
              <div className="flex gap-2 justify-center mb-2">
                <Button variant="outline" size="sm" onClick={generateQR} disabled={saving}>
                  {saving ? "..." : "Generate new QR"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setManualEntry(true)}>
                  Enter QR manually
                </Button>
              </div>
              {manualEntry && (
                <div className="flex gap-2 mt-3">
                  <Input
                    value={qrDraft}
                    onChange={(e) => setQrDraft(e.target.value)}
                    placeholder="Paste or type QR code..."
                    className="flex-1"
                    onKeyDown={(e) => { if (e.key === "Enter") saveManualQR(); if (e.key === "Escape") setManualEntry(false); }}
                    autoFocus
                  />
                  <Button size="sm" onClick={saveManualQR} disabled={saving}>Save</Button>
                  <Button variant="outline" size="sm" onClick={() => setManualEntry(false)}>Cancel</Button>
                </div>
              )}
              {error && <div className="text-destructive text-sm mt-2 text-center">{error}</div>}
            </>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
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
    { label: "Residual value", key: "residualValue", value: asset.residualValue ? String(asset.residualValue) : "", placeholder: "Add residual value" },
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
        <div className="col-span-full px-4 pt-4 pb-1">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</Label>
          <Separator className="mt-1.5" />
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
          <>
            <DatePickerField
              label="Purchase date"
              value={asset.purchaseDate ? asset.purchaseDate.slice(0, 10) : ""}
              placeholder="Add purchase date"
              canEdit={canEdit}
              onSave={(v) => saveField("purchaseDate", v)}
            />
            <DatePickerField
              label="Warranty date"
              value={asset.warrantyDate ? String(asset.warrantyDate).slice(0, 10) : ""}
              placeholder="Add warranty date"
              canEdit={canEdit}
              onSave={(v) => saveField("warrantyDate", v)}
            />
            <FiscalYearField
              value={asset.metadata?.fiscalYearPurchased || ""}
              canEdit={canEdit}
              onSave={(v) => saveField("metadata.fiscalYearPurchased", v)}
            />
          </>
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
    </Card>
  );
}
