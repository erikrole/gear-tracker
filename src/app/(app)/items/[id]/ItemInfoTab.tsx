"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogCloseButton,
} from "@/components/ui/dialog";
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
  CommandSeparator,
} from "@/components/ui/command";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Calendar } from "@/components/ui/calendar";
import {
  CalendarIcon,
  Check,
  ChevronsUpDown,
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
import { format, parse, isValid } from "date-fns";
import type { AssetDetail, CategoryOption } from "./types";
import { SaveableField, useSaveField } from "@/components/SaveableField";

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
        className={cn("h-8 text-right text-sm", mono && "font-mono")}
      />
    </SaveableField>
  );
}

/* ── Textarea Field (Description) ──────────────────────── */

function TextareaField({
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
    <SaveableField label={label} status={saveField.status} htmlFor={fieldId} className="items-start">
      <Textarea
        id={fieldId}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        placeholder={placeholder}
        disabled={!canEdit}
        className="min-h-[60px] text-sm resize-none"
        rows={2}
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
          className="h-8 text-sm flex-1"
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

/* ── Date Picker Input Field ───────────────────────────── */

const DATE_FORMATS = [
  "MM/dd/yyyy",
  "M/d/yyyy",
  "MM-dd-yyyy",
  "M-d-yyyy",
  "MMM d, yyyy",
  "MMMM d, yyyy",
  "yyyy-MM-dd",
];

function parseDateInput(input: string): Date | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  for (const fmt of DATE_FORMATS) {
    const parsed = parse(trimmed, fmt, new Date());
    if (isValid(parsed) && parsed.getFullYear() > 1900 && parsed.getFullYear() < 2100) {
      return parsed;
    }
  }
  return null;
}

function DatePickerField({
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
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ? format(new Date(value + "T00:00:00"), "MM/dd/yyyy") : "");
  const saveField = useSaveField(onSave);
  const fieldId = useId();

  const dateValue = value ? new Date(value + "T00:00:00") : undefined;

  useEffect(() => {
    setDraft(value ? format(new Date(value + "T00:00:00"), "MM/dd/yyyy") : "");
  }, [value]);

  async function commitTyped() {
    const trimmed = draft.trim();
    if (!trimmed) {
      if (value) await saveField.save("");
      return;
    }
    const parsed = parseDateInput(trimmed);
    if (!parsed) {
      setDraft(value ? format(new Date(value + "T00:00:00"), "MM/dd/yyyy") : "");
      return;
    }
    const iso = format(parsed, "yyyy-MM-dd");
    if (iso === value) return;
    await saveField.save(iso);
  }

  async function handleCalendarSelect(day: Date | undefined) {
    if (!day) return;
    const iso = format(day, "yyyy-MM-dd");
    if (iso === value) {
      setOpen(false);
      return;
    }
    await saveField.save(iso);
    setOpen(false);
  }

  async function handleClear() {
    await saveField.save("");
    setOpen(false);
  }

  return (
    <SaveableField label={label} status={saveField.status} htmlFor={fieldId}>
      <div className="flex items-center gap-1">
        <Input
          id={fieldId}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitTyped}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setDraft(value ? format(new Date(value + "T00:00:00"), "MM/dd/yyyy") : "");
            }
          }}
          placeholder={placeholder || "MM/DD/YYYY"}
          disabled={!canEdit}
          className="h-8 text-sm flex-1"
        />
        {canEdit && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8 shrink-0">
                <CalendarIcon className="size-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={dateValue}
                onSelect={handleCalendarSelect}
                defaultMonth={dateValue}
              />
              {value && (
                <div className="border-t px-3 py-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground"
                    onClick={handleClear}
                  >
                    Clear date
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        )}
      </div>
    </SaveableField>
  );
}

/* ── Combobox Field (generic) ──────────────────────────── */

function ComboboxField({
  label,
  value,
  options,
  placeholder,
  searchPlaceholder,
  canEdit,
  onSave,
  emptyLabel,
}: {
  label: string;
  value: string;
  options: string[];
  placeholder?: string;
  searchPlaceholder?: string;
  canEdit: boolean;
  onSave: (v: string) => Promise<void>;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const saveField = useSaveField(onSave);

  return (
    <SaveableField label={label} status={saveField.status}>
      {canEdit ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="h-8 w-full justify-between text-sm font-normal"
            >
              {value || (
                <span className="text-muted-foreground">{placeholder || "Select..."}</span>
              )}
              <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[220px] p-0" align="end">
            <Command>
              <CommandInput placeholder={searchPlaceholder || "Search..."} />
              <CommandList>
                <CommandEmpty>{emptyLabel || "No results."}</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value=" "
                    onSelect={async () => {
                      if (!value) { setOpen(false); return; }
                      await saveField.save("");
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4",
                        !value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="text-muted-foreground">&mdash;</span>
                  </CommandItem>
                  {options.map((opt) => (
                    <CommandItem
                      key={opt}
                      value={opt}
                      onSelect={async () => {
                        if (value === opt) { setOpen(false); return; }
                        await saveField.save(opt);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 size-4",
                          value === opt ? "opacity-100" : "opacity-0",
                        )}
                      />
                      {opt}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      ) : (
        <span className="text-sm">{value || "\u2014"}</span>
      )}
    </SaveableField>
  );
}

/* ── Category Field (with grouped parents) ─────────────── */

function CategoryField({
  value,
  currentId,
  canEdit,
  categories,
  onSave,
  onCategoriesChanged,
}: {
  value: string;
  currentId: string;
  canEdit: boolean;
  categories: CategoryOption[];
  onSave: (id: string) => Promise<void>;
  onCategoriesChanged: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const saveField = useSaveField(onSave);

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  // Group categories by parent
  const parentMap = new Map<string, CategoryOption[]>();
  const topLevel: CategoryOption[] = [];

  for (const cat of categories) {
    if (cat.parentId) {
      const children = parentMap.get(cat.parentId) || [];
      children.push(cat);
      parentMap.set(cat.parentId, children);
    }
  }

  for (const cat of categories) {
    if (!cat.parentId && !parentMap.has(cat.id)) {
      topLevel.push(cat);
    }
  }

  const parentCategories = categories.filter((c) => !c.parentId && parentMap.has(c.id));

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
          className="h-8 text-sm"
        />
      ) : canEdit ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="h-8 w-full justify-between text-sm font-normal"
            >
              {value || (
                <span className="text-muted-foreground">Select category</span>
              )}
              <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[240px] p-0" align="end">
            <Command>
              <CommandInput placeholder="Search categories..." />
              <CommandList>
                <CommandEmpty>No category found.</CommandEmpty>
                {/* Clear option */}
                <CommandGroup>
                  <CommandItem
                    value=" "
                    onSelect={async () => {
                      if (!currentId) { setOpen(false); return; }
                      await saveField.save("");
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4",
                        !currentId ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="text-muted-foreground">&mdash;</span>
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
                {/* Top-level categories (no children) */}
                {topLevel.length > 0 && (
                  <CommandGroup heading="Categories">
                    {topLevel.map((cat) => (
                      <CommandItem
                        key={cat.id}
                        value={cat.name}
                        onSelect={async () => {
                          if (currentId === cat.id) { setOpen(false); return; }
                          await saveField.save(cat.id);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 size-4",
                            currentId === cat.id ? "opacity-100" : "opacity-0",
                          )}
                        />
                        {cat.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {/* Grouped categories (parent → children) */}
                {parentCategories.map((parent) => (
                  <CommandGroup key={parent.id} heading={parent.name}>
                    {(parentMap.get(parent.id) || []).map((child) => (
                      <CommandItem
                        key={child.id}
                        value={`${parent.name} ${child.name}`}
                        onSelect={async () => {
                          if (currentId === child.id) { setOpen(false); return; }
                          await saveField.save(child.id);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 size-4",
                            currentId === child.id ? "opacity-100" : "opacity-0",
                          )}
                        />
                        {child.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      setOpen(false);
                      setCreating(true);
                    }}
                  >
                    + Create new category
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      ) : (
        <span className="text-sm">{value || "\u2014"}</span>
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
    <div ref={ref} className="col-span-full px-4 pt-4 pb-1" {...props}>
      <div className="flex items-center gap-1.5 w-full text-left group cursor-pointer">
        <ChevronDown
          className={cn(
            "size-3.5 text-muted-foreground transition-transform duration-200",
            !open && "-rotate-90",
          )}
        />
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer group-hover:text-foreground transition-colors">
          {title}
        </Label>
      </div>
      <Separator className="mt-1.5" />
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
    <Card className="details-card">
      <CardHeader>
        <CardTitle>Item Information</CardTitle>
      </CardHeader>
      <div>
        {/* ── Identity Section ── */}
        <Collapsible open={identityOpen} onOpenChange={setIdentityOpen}>
          <CollapsibleTrigger asChild>
            <SectionHeader title="Identity" open={identityOpen} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="grid grid-cols-1 sm:grid-cols-2">
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
              <div className="sm:col-span-2">
                <TextareaField
                  label="Description"
                  value={asset.metadata?.description || ""}
                  placeholder="Add description"
                  canEdit={canEdit}
                  onSave={(v) => saveField("metadata.description", v)}
                />
              </div>
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
              <div className="grid grid-cols-1 sm:grid-cols-2">
                <TextInputField
                  label="Purchase price"
                  value={
                    asset.purchasePrice ? String(asset.purchasePrice) : ""
                  }
                  placeholder="Add purchase price"
                  canEdit={canEdit}
                  onSave={(v) => saveField("purchasePrice", v)}
                />
                <TextInputField
                  label="Residual value"
                  value={
                    asset.residualValue ? String(asset.residualValue) : ""
                  }
                  placeholder="Add residual value"
                  canEdit={canEdit}
                  onSave={(v) => saveField("residualValue", v)}
                />
                <div className="sm:col-span-2">
                  <LinkField
                    label="Link"
                    value={asset.linkUrl || ""}
                    placeholder="Add product link"
                    canEdit={canEdit}
                    onSave={(v) => saveField("linkUrl", v)}
                  />
                </div>
                <DatePickerField
                  label="Purchase date"
                  value={
                    asset.purchaseDate
                      ? asset.purchaseDate.slice(0, 10)
                      : ""
                  }
                  canEdit={canEdit}
                  onSave={(v) => saveField("purchaseDate", v)}
                />
                <DatePickerField
                  label="Warranty date"
                  value={
                    asset.warrantyDate
                      ? String(asset.warrantyDate).slice(0, 10)
                      : ""
                  }
                  canEdit={canEdit}
                  onSave={(v) => saveField("warrantyDate", v)}
                />
                <ComboboxField
                  label="Fiscal Year"
                  value={asset.metadata?.fiscalYearPurchased || ""}
                  options={fiscalYearOptions}
                  placeholder="Select fiscal year"
                  searchPlaceholder="Search years..."
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
            <div className="grid grid-cols-1 sm:grid-cols-2">
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
              <ComboboxField
                label="Department"
                value={asset.department?.name || ""}
                options={departments.map((d) => d.name)}
                placeholder="Select department"
                searchPlaceholder="Search departments..."
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
              <div className="sm:col-span-2">
                <CategoryField
                  value={asset.category?.name || ""}
                  currentId={asset.category?.id || ""}
                  canEdit={canEdit}
                  categories={categories}
                  onSave={saveCategory}
                  onCategoriesChanged={onCategoriesChanged}
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </Card>
  );
}
