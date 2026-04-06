"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogCloseButton,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Check,
  ExternalLink,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { AssetDetail, CategoryOption } from "./types";
import { SaveableField, useSaveField } from "@/components/SaveableField";
import { CategoryCombobox } from "@/components/FormCombobox";

/* ── Text Input Field ──────────────────────────────────── */

function TextInputField({
  label,
  value,
  placeholder,
  canEdit,
  onSave,
  mono,
  readOnly,
  warnDuplicate,
}: {
  label: string;
  value: string;
  placeholder?: string;
  canEdit: boolean;
  onSave: (v: string) => Promise<void>;
  mono?: boolean;
  readOnly?: boolean;
  /** If set, checks for duplicate values on blur via search API */
  warnDuplicate?: { field: "assetTag" | "serialNumber"; assetId: string };
}) {
  const [draft, setDraft] = useState(value);
  const [dupWarning, setDupWarning] = useState("");
  const saveField = useSaveField(onSave);
  const fieldId = useId();

  useEffect(() => {
    setDraft(value);
  }, [value]);

  async function checkDuplicate(val: string) {
    if (!warnDuplicate || !val || val === value) { setDupWarning(""); return; }
    try {
      const res = await fetch(`/api/assets?q=${encodeURIComponent(val)}&limit=5`);
      if (!res.ok) return;
      const json = await res.json();
      const matches = (json.data || []).filter(
        (a: { id: string; assetTag: string; serialNumber: string }) =>
          a.id !== warnDuplicate.assetId &&
          (warnDuplicate.field === "assetTag" ? a.assetTag === val : a.serialNumber === val)
      );
      setDupWarning(matches.length > 0 ? `Duplicate found: ${matches[0].assetTag}` : "");
    } catch { /* ignore */ }
  }

  async function commit() {
    const trimmed = draft.trim();
    if (trimmed === value) return;
    await checkDuplicate(trimmed);
    await saveField.save(trimmed);
  }

  return (
    <SaveableField label={label} status={saveField.status} htmlFor={fieldId}>
      <div className="flex-1 min-w-0">
        <Input
          id={fieldId}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
            if (e.key === "Escape") {
              setDraft(value);
              saveField.reset();
              setDupWarning("");
            }
          }}
          placeholder={placeholder}
          disabled={!canEdit || readOnly}
          className={cn(
            "h-8 text-sm border-transparent bg-transparent shadow-none",
            "hover:bg-muted/60 hover:border-border/50",
            "focus-visible:bg-background focus-visible:border-ring focus-visible:shadow-xs",
            mono && "font-mono",
          )}
        />
        {dupWarning && (
          <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5 px-1">{dupWarning}</p>
        )}
      </div>
    </SaveableField>
  );
}

/* ── Link Field (with open/copy buttons) ───────────────── */

function LinkField({
  label,
  value,
  placeholder,
  canEdit,
  onSave,
}: {
  label: string;
  value: string;
  placeholder?: string;
  canEdit: boolean;
  onSave: (v: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value);
  const [copied, setCopied] = useState(false);
  const saveField = useSaveField(onSave);
  const fieldId = useId();

  useEffect(() => {
    setDraft(value);
  }, [value]);

  async function commit() {
    const trimmed = draft.trim();
    if (trimmed === value) return;
    await saveField.save(trimmed);
  }

  async function copyUrl() {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <SaveableField label={label} status={saveField.status} htmlFor={fieldId}>
      <div className="flex items-center gap-1">
        <Input
          id={fieldId}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setDraft(value);
              saveField.reset();
            }
          }}
          placeholder={placeholder}
          disabled={!canEdit}
          className="h-8 text-sm flex-1 border-transparent bg-transparent shadow-none hover:bg-muted/60 hover:border-border/50 focus-visible:bg-background focus-visible:border-ring focus-visible:shadow-xs"
        />
        {value && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  onClick={() => window.open(value, "_blank", "noopener")}
                >
                  <ExternalLink className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open link</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  onClick={copyUrl}
                >
                  {copied ? (
                    <Check className="size-3.5 text-green-600 dark:text-green-400" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{copied ? "Copied!" : "Copy link"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </SaveableField>
  );
}

/* ── Saveable Date Picker (wraps DatePicker with inline save) ── */

function SaveableDatePickerField({
  label,
  value,
  canEdit,
  onSave,
}: {
  label: string;
  value: string;
  canEdit: boolean;
  onSave: (v: string) => Promise<void>;
}) {
  const saveField = useSaveField(onSave);
  const dateValue = value ? new Date(value + "T00:00:00") : undefined;

  return (
    <SaveableField label={label} status={saveField.status}>
      <DatePicker
        value={dateValue}
        onChange={async (day) => {
          const iso = day ? format(day, "yyyy-MM-dd") : "";
          if (iso === value) return;
          await saveField.save(iso);
        }}
        disabled={!canEdit}
      />
    </SaveableField>
  );
}

/* ── Saveable Native Select (wraps NativeSelect with inline save) ── */

function SaveableNativeSelectField({
  label,
  value,
  options,
  placeholder,
  canEdit,
  onSave,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  canEdit: boolean;
  onSave: (v: string) => Promise<void>;
}) {
  const saveField = useSaveField(onSave);

  if (!canEdit) {
    const selected = options.find((o) => o.value === value);
    return (
      <SaveableField label={label} status={saveField.status}>
        <span className="text-sm">{selected?.label || "\u2014"}</span>
      </SaveableField>
    );
  }

  return (
    <SaveableField label={label} status={saveField.status}>
      <NativeSelect
        value={value}
        onChange={async (e) => {
          const v = e.target.value;
          if (v === value) return;
          await saveField.save(v);
        }}
        className="h-8 text-sm border-transparent bg-transparent shadow-none hover:bg-muted/60 hover:border-border/50 focus-visible:bg-background focus-visible:border-ring focus-visible:shadow-xs"
      >
        <option value="">{placeholder || "Select..."}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </NativeSelect>
    </SaveableField>
  );
}

/* ── Saveable Category Field (wraps CategoryCombobox with inline save + create) ── */

function SaveableCategoryField({
  currentId,
  canEdit,
  categories,
  onSave,
  onCategoriesChanged,
  displayName,
  ghost,
}: {
  currentId: string;
  canEdit: boolean;
  categories: CategoryOption[];
  onSave: (id: string) => Promise<void>;
  onCategoriesChanged: () => void;
  displayName: string;
  ghost?: boolean;
}) {
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const saveField = useSaveField(onSave);

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  async function handleCreateCategory() {
    if (!newCatName.trim()) {
      setCreating(false);
      return;
    }
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
        toast(
          (json as Record<string, string>).error || "Failed to create category",
          "error",
        );
      }
    } catch {
      toast("Failed to create category", "error");
    }
    setSaving(false);
    setCreating(false);
    setNewCatName("");
  }

  return (
    <SaveableField label="Category" status={saveField.status}>
      {creating ? (
        <Input
          ref={inputRef}
          value={newCatName}
          onChange={(e) => setNewCatName(e.target.value)}
          placeholder="Category name"
          disabled={saving}
          onBlur={handleCreateCategory}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreateCategory();
            if (e.key === "Escape") {
              setCreating(false);
              setNewCatName("");
            }
          }}
          className="h-8 text-sm border-transparent bg-transparent shadow-none hover:bg-muted/60 hover:border-border/50 focus-visible:bg-background focus-visible:border-ring focus-visible:shadow-xs"
        />
      ) : (
        <CategoryCombobox
          value={currentId}
          onValueChange={async (id) => {
            if (id === currentId) return;
            await saveField.save(id);
          }}
          categories={categories}
          allowClear
          allowCreate
          onCreateRequested={() => setCreating(true)}
          disabled={!canEdit}
          disabledLabel={displayName}
          variant={ghost ? "ghost" : "outline"}
        />
      )}
    </SaveableField>
  );
}

/* ── QR Code Visual ─────────────────────────────────────── */

export function QRCodeCanvas({
  value,
  size,
  margin = 2,
}: {
  value: string;
  size: number;
  margin?: number;
}) {
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

export function QRModal({
  asset,
  canEdit,
  onRefresh,
  open,
  onOpenChange,
}: {
  asset: AssetDetail;
  canEdit: boolean;
  onRefresh: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [manualEntry, setManualEntry] = useState(false);
  const [qrDraft, setQrDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function generateQR() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/assets/${asset.id}/generate-qr`, {
        method: "POST",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError((json as Record<string, string>).error || "Failed");
      }
      onRefresh();
    } catch {
      setError("Network error \u2014 please try again.");
    }
    setSaving(false);
  }

  async function saveManualQR() {
    if (!qrDraft.trim()) {
      setManualEntry(false);
      return;
    }
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
          <DialogDescription className="sr-only">View or generate a QR code for this item</DialogDescription>
          <DialogCloseButton />
        </DialogHeader>
        <DialogBody className="py-6">
          <div className="flex justify-center mb-1">
            <QRCodeCanvas value={asset.qrCodeValue} size={240} />
          </div>
          <div className="font-semibold font-mono text-center text-sm mb-1">
            {asset.qrCodeValue}
          </div>
          {canEdit && (
            <>
              <div className="flex gap-2 justify-center mb-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateQR}
                  disabled={saving}
                >
                  {saving ? "..." : "Generate new QR"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setManualEntry(true)}
                >
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
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveManualQR();
                      if (e.key === "Escape") setManualEntry(false);
                    }}
                    autoFocus
                  />
                  <Button size="sm" onClick={saveManualQR} disabled={saving}>
                    Save
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setManualEntry(false)}
                  >
                    Cancel
                  </Button>
                </div>
              )}
              {error && (
                <div className="text-destructive text-sm mt-2 text-center">
                  {error}
                </div>
              )}
            </>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

/* ── Item Info Card (tab entry point) ───────────────────── */

export type LocationOption = { id: string; name: string };
export type DepartmentOption = { id: string; name: string };

export default function ItemInfoCard({
  asset,
  canEdit,
  currentUserRole,
  categories,
  departments,
  locations,
  onFieldSaved,
  onRefresh,
  onCategoriesChanged,
  onDepartmentsChanged,
}: {
  asset: AssetDetail;
  canEdit: boolean;
  currentUserRole: string;
  categories: CategoryOption[];
  departments: DepartmentOption[];
  locations: LocationOption[];
  onFieldSaved: (updated: Partial<AssetDetail>) => void;
  onRefresh: () => void;
  onCategoriesChanged: () => void;
  onDepartmentsChanged: () => void;
}) {
  const saveField = useCallback(
    async (patchKey: string, value: string) => {
      const body: Record<string, unknown> = {};
      if (patchKey === "purchasePrice" || patchKey === "residualValue") {
        const num = parseFloat(value);
        if (value && isNaN(num)) {
          throw new Error("Invalid number");
        }
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
        throw new Error(
          (json as Record<string, string>).error || "Save failed",
        );
      }

      if (patchKey.startsWith("metadata.")) {
        const metaKey = patchKey.split(".")[1];
        onFieldSaved({ metadata: { ...asset.metadata, [metaKey]: value } });
      } else {
        onFieldSaved({
          [patchKey]:
            patchKey === "purchasePrice" || patchKey === "residualValue"
              ? parseFloat(value)
              : value,
        } as Partial<AssetDetail>);
      }
    },
    [asset.id, asset.metadata, onFieldSaved],
  );

  async function saveCategory(categoryId: string) {
    const res = await fetch(`/api/assets/${asset.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId: categoryId || null }),
    });
    if (!res.ok) {
      throw new Error("Failed to save category");
    }
    onRefresh();
  }

  async function saveDepartment(departmentName: string) {
    // Find department by name
    const dept = departments.find((d) => d.name === departmentName);
    const departmentId = dept?.id || null;
    const res = await fetch(`/api/assets/${asset.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ departmentId }),
    });
    if (!res.ok) {
      throw new Error("Failed to save department");
    }
    onRefresh();
  }

  async function saveLocation(locationId: string) {
    const res = await fetch(`/api/assets/${asset.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId }),
    });
    if (!res.ok) {
      throw new Error("Failed to save location");
    }
    onRefresh();
  }

  /** Compute fiscal year from a date string (FY begins July 1) */
  function computeFiscalYear(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00");
    if (isNaN(d.getTime())) return "";
    const month = d.getMonth(); // 0-indexed
    const year = d.getFullYear();
    // FY begins July 1: dates in Jul-Dec belong to FY (year+1), Jan-Jun belong to FY (year)
    return String(month >= 6 ? year + 1 : year);
  }

  return (
    <Card className="details-card border-border/40">
      <div className="py-1">
        <div className="grid grid-cols-1 gap-y-0 divide-y divide-border/30">
          <TextInputField
            label="Name"
            value={asset.assetTag}
            canEdit={canEdit}
            onSave={(v) => saveField("assetTag", v)}
          />
          <TextInputField
            label="Product Name"
            value={asset.name || ""}
            placeholder="Add product name"
            canEdit={canEdit}
            onSave={(v) => saveField("name", v)}
          />
          <TextInputField
            label="Brand"
            value={asset.brand}
            placeholder="Add brand"
            canEdit={canEdit}
            onSave={(v) => saveField("brand", v)}
          />
          <TextInputField
            label="Model"
            value={asset.model}
            placeholder="Add model"
            canEdit={canEdit}
            onSave={(v) => saveField("model", v)}
          />
          <TextInputField
            label="Serial"
            value={asset.serialNumber}
            canEdit={canEdit}
            onSave={(v) => saveField("serialNumber", v)}
            mono
            warnDuplicate={{ field: "serialNumber", assetId: asset.id }}
          />
          <TextInputField
            label="UW Asset Tag"
            value={asset.metadata?.uwAssetTag || ""}
            placeholder="Add UW asset tag"
            canEdit={canEdit}
            onSave={(v) => saveField("metadata.uwAssetTag", v)}
          />
          <SaveableNativeSelectField
            label="Department"
            value={asset.department?.name || ""}
            options={departments.map((d) => ({ value: d.name, label: d.name }))}
            placeholder="Select department"
            canEdit={canEdit}
            onSave={saveDepartment}
          />
          <SaveableCategoryField
            currentId={asset.category?.id || ""}
            displayName={asset.category?.name || ""}
            canEdit={canEdit}
            categories={categories}
            onSave={saveCategory}
            onCategoriesChanged={onCategoriesChanged}
            ghost
          />
          <SaveableNativeSelectField
            label="Location"
            value={asset.location.id}
            options={locations.map((l) => ({ value: l.id, label: l.name }))}
            placeholder="Select location"
            canEdit={canEdit}
            onSave={saveLocation}
          />
          {/* ── Procurement fields (hidden from students) ── */}
          {currentUserRole !== "STUDENT" && (
            <>
              <SaveableDatePickerField
                label="Purchase date"
                value={
                  asset.purchaseDate
                    ? asset.purchaseDate.slice(0, 10)
                    : ""
                }
                canEdit={canEdit}
                onSave={async (v) => {
                  await saveField("purchaseDate", v);
                  if (v) {
                    const fy = computeFiscalYear(v);
                    if (fy) await saveField("metadata.fiscalYearPurchased", fy);
                  }
                }}
              />
              <TextInputField
                label="Fiscal Year"
                value={asset.metadata?.fiscalYearPurchased || ""}
                placeholder="Auto-filled from purchase date"
                canEdit={canEdit}
                onSave={(v) => saveField("metadata.fiscalYearPurchased", v)}
              />
              <TextInputField
                label="Purchase price"
                value={
                  asset.purchasePrice ? String(asset.purchasePrice) : ""
                }
                placeholder="Add purchase price"
                canEdit={canEdit}
                onSave={(v) => saveField("purchasePrice", v)}
              />
              <LinkField
                label="Link"
                value={asset.linkUrl || ""}
                placeholder="Add product link"
                canEdit={canEdit}
                onSave={(v) => saveField("linkUrl", v)}
              />
            </>
          )}
          {/* ── Notes section ── */}
          <NotesField
            value={asset.metadata?.userNotes || ""}
            canEdit={canEdit}
            onSave={(v) => saveField("metadata.userNotes", v)}
          />
        </div>
      </div>
    </Card>
  );
}

/* ── Notes Field (inline-editable textarea) ─────────────── */

function NotesField({
  value,
  canEdit,
  onSave,
}: {
  value: string;
  canEdit: boolean;
  onSave: (v: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value);
  const saveField = useSaveField(onSave);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  async function commit() {
    const trimmed = draft.trim();
    if (trimmed === (value || "")) return;
    await saveField.save(trimmed);
  }

  return (
    <SaveableField label="Notes" status={saveField.status}>
      {canEdit ? (
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          placeholder="Add notes..."
          rows={3}
          className="text-sm border-transparent bg-transparent shadow-none resize-none hover:bg-muted/60 hover:border-border/50 focus-visible:bg-background focus-visible:border-ring focus-visible:shadow-xs"
        />
      ) : (
        <p className="text-sm whitespace-pre-wrap py-1.5 px-3">
          {value || <span className="text-muted-foreground">No notes</span>}
        </p>
      )}
    </SaveableField>
  );
}
