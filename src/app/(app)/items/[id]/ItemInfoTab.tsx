"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import { Input } from "@/components/ui/input";
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
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Check,
  ChevronDown,
  ExternalLink,
  Copy,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { AssetDetail, CategoryOption } from "./types";
import { SaveableField, useSaveField } from "@/components/SaveableField";
import { CategoryCombobox } from "@/components/FormCombobox";

/* ── Constants ─────────────────────────────────────────── */

function getFiscalYearOptions(): string[] {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const currentFY = month >= 6 ? year + 1 : year;
  const options: string[] = [];
  for (let fy = currentFY + 1; fy >= currentFY - 10; fy--) {
    options.push(String(fy));
  }
  return options;
}

/* ── Text Input Field ──────────────────────────────────── */

function TextInputField({
  label,
  value,
  placeholder,
  canEdit,
  onSave,
  mono,
  readOnly,
}: {
  label: string;
  value: string;
  placeholder?: string;
  canEdit: boolean;
  onSave: (v: string) => Promise<void>;
  mono?: boolean;
  readOnly?: boolean;
}) {
  const [draft, setDraft] = useState(value);
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

  return (
    <SaveableField label={label} status={saveField.status} htmlFor={fieldId}>
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
}: {
  currentId: string;
  canEdit: boolean;
  categories: CategoryOption[];
  onSave: (id: string) => Promise<void>;
  onCategoriesChanged: () => void;
  displayName: string;
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

/* ── Collapsible Section Header ────────────────────────── */

const SectionHeader = React.forwardRef<
  HTMLDivElement,
  { title: string; open: boolean } & React.HTMLAttributes<HTMLDivElement>
>(function SectionHeader({ title, open, ...props }, ref) {
  return (
    <div ref={ref} className="col-span-full px-3 pt-5 pb-1" {...props}>
      <div className="flex items-center gap-1.5 w-full text-left group cursor-pointer border-b border-border/40 pb-1.5">
        <ChevronDown
          className={cn(
            "size-3 text-muted-foreground/60 transition-transform duration-200",
            !open && "-rotate-90",
          )}
        />
        <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground/60 cursor-pointer group-hover:text-muted-foreground transition-colors">
          {title}
        </span>
      </div>
    </div>
  );
});

/* ── Item Info Card (tab entry point) ───────────────────── */

export type DepartmentOption = { id: string; name: string };

export default function ItemInfoCard({
  asset,
  canEdit,
  currentUserRole,
  categories,
  departments,
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
  onFieldSaved: (updated: Partial<AssetDetail>) => void;
  onRefresh: () => void;
  onCategoriesChanged: () => void;
  onDepartmentsChanged: () => void;
}) {
  const [identityOpen, setIdentityOpen] = useState(true);
  const [procurementOpen, setProcurementOpen] = useState(true);
  const [adminOpen, setAdminOpen] = useState(true);

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

  const fiscalYearOptions = getFiscalYearOptions();

  return (
    <Card className="details-card border-border/40 shadow-none">
      <div className="py-1">
        {/* ── Identity Section ── */}
        <Collapsible open={identityOpen} onOpenChange={setIdentityOpen}>
          <CollapsibleTrigger asChild>
            <SectionHeader title="Identity" open={identityOpen} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="grid grid-cols-1 gap-y-1">
              <TextInputField
                label="Asset tag"
                value={asset.assetTag}
                canEdit={canEdit}
                onSave={(v) => saveField("assetTag", v)}
              />
              <TextInputField
                label="Item name"
                value={asset.name || ""}
                placeholder="Add item name"
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
                label="Serial number"
                value={asset.serialNumber}
                canEdit={canEdit}
                onSave={(v) => saveField("serialNumber", v)}
                mono
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* ── Procurement Section ── */}
        {currentUserRole !== "STUDENT" && (
          <Collapsible open={procurementOpen} onOpenChange={setProcurementOpen}>
            <CollapsibleTrigger asChild>
              <SectionHeader title="Procurement" open={procurementOpen} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="grid grid-cols-1 gap-y-1">
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
                <SaveableDatePickerField
                  label="Purchase date"
                  value={
                    asset.purchaseDate
                      ? asset.purchaseDate.slice(0, 10)
                      : ""
                  }
                  canEdit={canEdit}
                  onSave={(v) => saveField("purchaseDate", v)}
                />
                <SaveableNativeSelectField
                  label="Fiscal Year"
                  value={asset.metadata?.fiscalYearPurchased || ""}
                  options={fiscalYearOptions.map((y) => ({ value: y, label: y }))}
                  placeholder="Select fiscal year"
                  canEdit={canEdit}
                  onSave={(v) =>
                    saveField("metadata.fiscalYearPurchased", v)
                  }
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* ── Administrative Section ── */}
        <Collapsible open={adminOpen} onOpenChange={setAdminOpen}>
          <CollapsibleTrigger asChild>
            <SectionHeader title="Administrative" open={adminOpen} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="grid grid-cols-1 gap-y-1">
              <TextInputField
                label="Location"
                value={asset.location.name}
                canEdit={false}
                readOnly
                onSave={async () => {}}
              />
              <TextInputField
                label="Owner"
                value={asset.metadata?.owner || ""}
                placeholder="Add owner"
                canEdit={canEdit}
                onSave={(v) => saveField("metadata.owner", v)}
              />
              <SaveableNativeSelectField
                label="Department"
                value={asset.department?.name || ""}
                options={departments.map((d) => ({ value: d.name, label: d.name }))}
                placeholder="Select department"
                canEdit={canEdit}
                onSave={saveDepartment}
              />
              <TextInputField
                label="UW Asset Tag"
                value={asset.metadata?.uwAssetTag || ""}
                placeholder="Add UW asset tag"
                canEdit={canEdit}
                onSave={(v) => saveField("metadata.uwAssetTag", v)}
              />
              <SaveableCategoryField
                  currentId={asset.category?.id || ""}
                  displayName={asset.category?.name || ""}
                  canEdit={canEdit}
                  categories={categories}
                  onSave={saveCategory}
                  onCategoriesChanged={onCategoriesChanged}
                />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </Card>
  );
}
