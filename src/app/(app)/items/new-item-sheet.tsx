"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2Icon, Dices, ScanLine, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircleIcon } from "lucide-react";
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
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import QrScanner from "@/components/QrScanner";

type CategoryOption = { id: string; name: string; parentId: string | null };
type Location = { id: string; name: string };
type Department = { id: string; name: string };

interface NewItemSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locations: Location[];
  departments: Department[];
  categories: CategoryOption[];
  onCreated: () => void;
}

type ItemKind = "serialized" | "bulk";
type BulkMode = "new" | "existing";

type BulkSkuOption = {
  id: string;
  name: string;
  location: { name: string };
  balances: { onHandQuantity: number }[];
  categoryRel: { name: string } | null;
};

type ParentSearchResult = {
  id: string;
  assetTag: string;
  name: string | null;
  brand: string;
  model: string;
};

// --- Layout helpers ---

function FormRow({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-start gap-4">
      <Label className="pt-2.5 text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <div>{children}</div>
    </div>
  );
}

function FormRow2Col({ label, required, children }: { label?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-start gap-4">
      <Label className="pt-2.5 text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{children}</h3>;
}

// --- Utilities ---

function SuccessFlash({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
      <CheckCircle2Icon className="size-4 shrink-0" />
      {message}
    </div>
  );
}

function generateQrCode(): string {
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  const hex = Array.from(array).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `QR-${hex}`;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    setIsMobile(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
  }, []);
  return isMobile;
}

function getFiscalYearOptions(): string[] {
  const now = new Date();
  const calYear = now.getFullYear();
  const currentFY = now.getMonth() >= 6 ? calYear + 1 : calYear;
  const options: string[] = [];
  for (let y = currentFY - 5; y <= currentFY + 2; y++) {
    options.push(`FY${String(y).slice(-2)}`);
  }
  return options.reverse();
}

const FISCAL_YEARS = getFiscalYearOptions();

// --- Parent asset search hook ---

function useParentSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ParentSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/assets?q=${encodeURIComponent(query)}&limit=5`);
        const json = await res.json();
        if (res.ok) {
          setResults(
            (json.data || []).map((a: Record<string, unknown>) => ({
              id: a.id,
              assetTag: a.assetTag,
              name: a.name,
              brand: a.brand,
              model: a.model,
            }))
          );
        }
      } catch {
        // ignore
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  return { query, setQuery, results, searching, clear: () => { setQuery(""); setResults([]); } };
}

// --- Component ---

export function NewItemSheet({
  open,
  onOpenChange,
  locations,
  departments,
  categories,
  onCreated,
}: NewItemSheetProps) {
  const [kind, setKind] = useState<ItemKind>("serialized");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [addAnother, setAddAnother] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const successTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Controlled selects
  const [categoryId, setCategoryId] = useState("__none__");
  const [locationId, setLocationId] = useState("");
  const [departmentId, setDepartmentId] = useState("__none__");
  const [fiscalYear, setFiscalYear] = useState("__none__");

  // QR code
  const [qrCodeValue, setQrCodeValue] = useState("");
  const [showScanner, setShowScanner] = useState(false);

  // Settings
  const [availableForBooking, setAvailableForBooking] = useState(true);

  // Bulk mode
  const [bulkMode, setBulkMode] = useState<BulkMode>("new");
  const [existingBulkSkus, setExistingBulkSkus] = useState<BulkSkuOption[]>([]);
  const [selectedBulkSkuId, setSelectedBulkSkuId] = useState("");
  const [addQty, setAddQty] = useState(1);
  const [bulkQrCode, setBulkQrCode] = useState("");

  // Fetch existing bulk SKUs when bulk mode is selected
  useEffect(() => {
    if (kind !== "bulk" || !open) return;
    (async () => {
      try {
        const res = await fetch("/api/bulk-skus");
        const json = await res.json();
        if (res.ok) setExistingBulkSkus(json.data || []);
      } catch {
        // ignore
      }
    })();
  }, [kind, open]);

  // Accessory / parent
  const [isAccessory, setIsAccessory] = useState(false);
  const [parentAsset, setParentAsset] = useState<ParentSearchResult | null>(null);
  const parentSearch = useParentSearch();

  const isMobile = useIsMobile();
  const formRef = useRef<HTMLFormElement>(null);

  const resetAll = useCallback(() => {
    setError("");
    setSuccessMsg("");
    setCategoryId("__none__");
    setLocationId("");
    setDepartmentId("__none__");
    setFiscalYear("__none__");
    setQrCodeValue("");
    setShowScanner(false);
    setKind("serialized");
    setAvailableForBooking(true);
    setIsAccessory(false);
    setParentAsset(null);
    parentSearch.clear();
    setBulkMode("new");
    setSelectedBulkSkuId("");
    setAddQty(1);
    setBulkQrCode("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForAnother() {
    setError("");
    setQrCodeValue("");
    setShowScanner(false);
    setAvailableForBooking(true);
    setIsAccessory(false);
    setParentAsset(null);
    parentSearch.clear();
  }

  function showSuccessMsg(msg: string) {
    setSuccessMsg(msg);
    clearTimeout(successTimer.current);
    successTimer.current = setTimeout(() => setSuccessMsg(""), 3000);
  }

  useEffect(() => () => clearTimeout(successTimer.current), []);

  function validateSelects(): string | null {
    if (kind === "serialized") {
      if (!categoryId || categoryId === "__none__") return "Please select a category.";
      if (!departmentId || departmentId === "__none__") return "Please select a department.";
      if (isAccessory && !parentAsset) return "Please select a parent item for this accessory.";
      if (!locationId) return "Please select a location.";
    } else if (kind === "bulk" && bulkMode === "new") {
      if (!categoryId || categoryId === "__none__") return "Please select a category.";
      if (!locationId) return "Please select a location.";
    }
    return null;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const selectError = validateSelects();
    if (selectError) {
      setError(selectError);
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccessMsg("");
    const form = new FormData(e.currentTarget);

    try {
      let res: globalThis.Response;
      let createdLabel = "";

      if (kind === "serialized") {
        const notes: Record<string, string> = {};
        const fy = fiscalYear !== "__none__" ? fiscalYear : "";
        if (fy) notes.fiscalYear = fy;

        const resolvedCategoryId = categoryId === "__none__" ? "" : categoryId;
        const resolvedDepartmentId = departmentId === "__none__" ? "" : departmentId;
        const itemName = String(form.get("itemName") || "").trim();
        const purchasePriceStr = String(form.get("purchasePrice") || "").trim();
        const residualValueStr = String(form.get("residualValue") || "").trim();
        const assetTag = String(form.get("assetTag") || "");
        const serialNumber = String(form.get("serialNumber") || "").trim();

        // Accessories get booking disabled (matches existing attach behavior)
        const bookingEnabled = isAccessory ? false : availableForBooking;

        res = await fetch("/api/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assetTag,
            type: "equipment",
            brand: String(form.get("brand") || ""),
            model: String(form.get("model") || ""),
            qrCodeValue,
            locationId,
            availableForReservation: bookingEnabled,
            availableForCheckout: bookingEnabled,
            availableForCustody: bookingEnabled,
            ...(isAccessory && parentAsset ? { parentAssetId: parentAsset.id } : {}),
            ...(serialNumber ? { serialNumber } : {}),
            ...(resolvedCategoryId ? { categoryId: resolvedCategoryId } : {}),
            ...(resolvedDepartmentId ? { departmentId: resolvedDepartmentId } : {}),
            ...(itemName ? { name: itemName } : {}),
            ...(form.get("purchaseDate") ? { purchaseDate: String(form.get("purchaseDate")) } : {}),
            ...(purchasePriceStr ? { purchasePrice: parseFloat(purchasePriceStr) } : {}),
            ...(form.get("warrantyDate") ? { warrantyDate: String(form.get("warrantyDate")) } : {}),
            ...(residualValueStr ? { residualValue: parseFloat(residualValueStr) } : {}),
            ...(form.get("linkUrl") ? { linkUrl: String(form.get("linkUrl")) } : {}),
            ...(form.get("uwAssetTag") ? { uwAssetTag: String(form.get("uwAssetTag")) } : {}),
            ...(Object.keys(notes).length ? { notes: JSON.stringify(notes) } : {}),
          }),
        });
        createdLabel = assetTag || itemName || "Asset";
      } else if (bulkMode === "existing") {
        // Add quantity to an existing bulk SKU
        if (!selectedBulkSkuId || addQty < 1) {
          setError("Select a bulk item and enter a quantity to add.");
          setSubmitting(false);
          return;
        }
        res = await fetch(`/api/bulk-skus/${selectedBulkSkuId}/adjust`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quantityDelta: addQty,
            reason: "Added via New Item sheet",
          }),
        });
        const sku = existingBulkSkus.find((s) => s.id === selectedBulkSkuId);
        createdLabel = sku?.name || "Bulk item";
      } else {
        // Create new bulk SKU
        const resolvedCategoryId = categoryId === "__none__" ? "" : categoryId;
        const bulkName = String(form.get("bulkName") || "");
        res = await fetch("/api/bulk-skus", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: bulkName,
            category: "general",
            ...(resolvedCategoryId ? { categoryId: resolvedCategoryId } : {}),
            locationId,
            binQrCodeValue: bulkQrCode,
            initialQuantity: parseInt(String(form.get("initialQuantity") || "0"), 10),
          }),
        });
        createdLabel = bulkName || "Bulk item";
      }

      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to create item");
        setSubmitting(false);
        return;
      }

      setSubmitting(false);
      onCreated();

      if (addAnother) {
        formRef.current?.reset();
        resetForAnother();
        showSuccessMsg(`"${createdLabel}" created — ready for next item`);
      } else {
        onOpenChange(false);
        resetAll();
      }
    } catch {
      setError("Network error");
      setSubmitting(false);
    }
  }

  // --- Shared select fragments ---

  const categorySelect = (
    <Select value={categoryId} onValueChange={setCategoryId}>
      <SelectTrigger>
        <SelectValue placeholder="Select a category" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">Select a category</SelectItem>
        {categories.filter((c) => !c.parentId).map((parent) => (
          <SelectGroup key={parent.id}>
            <SelectLabel>{parent.name}</SelectLabel>
            {categories.filter((c) => c.parentId === parent.id).map((child) => (
              <SelectItem key={child.id} value={child.id}>{child.name}</SelectItem>
            ))}
            {categories.filter((c) => c.parentId === parent.id).length === 0 && (
              <SelectItem value={parent.id}>{parent.name}</SelectItem>
            )}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );

  const locationSelect = (
    <Select value={locationId} onValueChange={setLocationId} required>
      <SelectTrigger>
        <SelectValue placeholder="Select a location" />
      </SelectTrigger>
      <SelectContent>
        {locations.map((l) => (
          <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetAll(); }}>
      <SheetContent className="sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>New item</SheetTitle>
          <SheetDescription>Add a new item to your inventory.</SheetDescription>
        </SheetHeader>

        <SheetBody className="px-6 py-6">
          <form id="new-item-form" ref={formRef} onSubmit={handleSubmit} className="space-y-6">
            {/* ── Item type ── */}
            <section className="space-y-3">
              <SectionHeading>Item type</SectionHeading>
              <RadioGroup value={kind} onValueChange={(v) => setKind(v as ItemKind)}>
                <div className="flex items-start gap-3">
                  <RadioGroupItem value="serialized" id="kind-serialized" className="mt-0.5" />
                  <div>
                    <Label htmlFor="kind-serialized" className="font-medium cursor-pointer">As an individual item</Label>
                    <p className="text-xs text-muted-foreground">
                      Recommended for unique, high-cost items (cameras, computers, etc.)
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <RadioGroupItem value="bulk" id="kind-bulk" className="mt-0.5" />
                  <div>
                    <Label htmlFor="kind-bulk" className="font-medium cursor-pointer">As a bulk item</Label>
                    <p className="text-xs text-muted-foreground">
                      Recommended for low-cost items (batteries, cables, sandbags, etc.)
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </section>

            <Separator />

            {successMsg && <SuccessFlash message={successMsg} />}

            {kind === "serialized" ? (
              <>
                {/* ── Identity ── */}
                <section className="space-y-4">
                  <SectionHeading>Identity</SectionHeading>

                  <FormRow label="Asset tag" required>
                    <Input name="assetTag" placeholder="Unique tag name" required />
                  </FormRow>

                  <FormRow label="Name" required>
                    <Input name="itemName" placeholder="e.g. Sony A7III Camera" required />
                  </FormRow>

                  <FormRow2Col label="Brand / Model" required>
                    <Input name="brand" placeholder="e.g. Sony" required />
                    <Input name="model" placeholder="e.g. A7III" required />
                  </FormRow2Col>

                  <FormRow label="Serial number">
                    <Input name="serialNumber" placeholder="Manufacturer serial (optional)" />
                  </FormRow>
                </section>

                {/* ── Organization ── */}
                <section className="space-y-4">
                  <SectionHeading>Organization</SectionHeading>

                  <FormRow label="Category" required>
                    {categorySelect}
                  </FormRow>

                  <FormRow label="Department" required>
                    <Select value={departmentId} onValueChange={setDepartmentId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Select a department</SelectItem>
                        {departments.map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormRow>

                  <FormRow label="Location" required>
                    {locationSelect}
                  </FormRow>
                </section>

                {/* ── Tracking ── */}
                <section className="space-y-4">
                  <SectionHeading>Tracking</SectionHeading>

                  <FormRow label="QR code" required>
                    <div className="flex gap-2">
                      <Input
                        value={qrCodeValue}
                        onChange={(e) => setQrCodeValue(e.target.value)}
                        placeholder="QR code value"
                        required
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        title="Generate QR code"
                        onClick={() => setQrCodeValue(generateQrCode())}
                      >
                        <Dices className="size-4" />
                      </Button>
                      {isMobile && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          title="Scan QR code"
                          onClick={() => setShowScanner((v) => !v)}
                        >
                          <ScanLine className="size-4" />
                        </Button>
                      )}
                    </div>
                    {showScanner && (
                      <div className="mt-2">
                        <QrScanner
                          active={showScanner}
                          onScan={(value) => {
                            setQrCodeValue(value);
                            setShowScanner(false);
                          }}
                          onError={() => setShowScanner(false)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="mt-1 w-full text-xs"
                          onClick={() => setShowScanner(false)}
                        >
                          Close scanner
                        </Button>
                      </div>
                    )}
                  </FormRow>

                  <FormRow label="UW Asset Tag">
                    <Input name="uwAssetTag" placeholder="Asset tag number" />
                  </FormRow>
                </section>

                {/* ── Procurement ── */}
                <section className="space-y-4">
                  <SectionHeading>Procurement</SectionHeading>

                  <FormRow2Col label="Purchase">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Date</Label>
                      <Input name="purchaseDate" type="date" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Price</Label>
                      <Input name="purchasePrice" type="number" min="0" step="0.01" placeholder="0.00" />
                    </div>
                  </FormRow2Col>

                  <FormRow2Col label="Warranty">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Date</Label>
                      <Input name="warrantyDate" type="date" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Residual value</Label>
                      <Input name="residualValue" type="number" min="0" step="0.01" placeholder="0" />
                    </div>
                  </FormRow2Col>

                  <FormRow label="Fiscal year">
                    <Select value={fiscalYear} onValueChange={setFiscalYear}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select fiscal year" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {FISCAL_YEARS.map((fy) => (
                          <SelectItem key={fy} value={fy}>{fy}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormRow>

                  <FormRow label="Link">
                    <Input name="linkUrl" type="url" placeholder="https://..." />
                  </FormRow>
                </section>

                {/* ── Settings ── */}
                <section className="space-y-4">
                  <SectionHeading>Settings</SectionHeading>

                  <div className="space-y-3">
                    {/* Accessory toggle */}
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <Label className="text-sm font-medium">Item is an accessory</Label>
                        <p className="text-xs text-muted-foreground">Attach to a parent item (e.g. lens → camera body)</p>
                      </div>
                      <Switch
                        checked={isAccessory}
                        onCheckedChange={(v) => {
                          setIsAccessory(v);
                          if (!v) {
                            setParentAsset(null);
                            parentSearch.clear();
                          }
                        }}
                      />
                    </div>

                    {/* Parent asset search (shown when accessory is toggled on) */}
                    {isAccessory && (
                      <div className="pl-0 space-y-2">
                        {parentAsset ? (
                          <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm">
                            <span className="flex-1 truncate">
                              <span className="font-medium">{parentAsset.assetTag}</span>
                              {" — "}
                              {parentAsset.name || `${parentAsset.brand} ${parentAsset.model}`}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-6"
                              onClick={() => { setParentAsset(null); parentSearch.clear(); }}
                            >
                              <X className="size-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <Input
                              value={parentSearch.query}
                              onChange={(e) => parentSearch.setQuery(e.target.value)}
                              placeholder="Search parent item by tag, brand, or model..."
                            />
                            {parentSearch.searching && (
                              <p className="text-xs text-muted-foreground px-1">Searching...</p>
                            )}
                            {parentSearch.results.length > 0 && (
                              <div className="rounded-md border divide-y text-sm">
                                {parentSearch.results.map((item) => (
                                  <button
                                    key={item.id}
                                    type="button"
                                    className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors"
                                    onClick={() => {
                                      setParentAsset(item);
                                      parentSearch.clear();
                                    }}
                                  >
                                    <span className="font-medium">{item.assetTag}</span>
                                    {" — "}
                                    {item.name || `${item.brand} ${item.model}`}
                                  </button>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Accessories are not available for independent booking.
                        </p>
                      </div>
                    )}

                    {/* Booking availability (hidden for accessories — they auto-disable) */}
                    {!isAccessory && (
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <Label className="text-sm font-medium">Available for booking</Label>
                          <p className="text-xs text-muted-foreground">Item can be reserved and checked out</p>
                        </div>
                        <Switch checked={availableForBooking} onCheckedChange={setAvailableForBooking} />
                      </div>
                    )}
                  </div>
                </section>
              </>
            ) : (
              <>
                {/* ── Bulk sub-mode: add new vs add to existing ── */}
                <section className="space-y-3">
                  <SectionHeading>Bulk option</SectionHeading>
                  <RadioGroup value={bulkMode} onValueChange={(v) => setBulkMode(v as BulkMode)}>
                    <div className="flex items-start gap-3">
                      <RadioGroupItem value="new" id="bulk-new" className="mt-0.5" />
                      <div>
                        <Label htmlFor="bulk-new" className="font-medium cursor-pointer">Create new bulk item</Label>
                        <p className="text-xs text-muted-foreground">Add a new product to track in bulk</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <RadioGroupItem value="existing" id="bulk-existing" className="mt-0.5" />
                      <div>
                        <Label htmlFor="bulk-existing" className="font-medium cursor-pointer">Add to existing</Label>
                        <p className="text-xs text-muted-foreground">Add more stock to an item you already track</p>
                      </div>
                    </div>
                  </RadioGroup>
                </section>

                <Separator />

                {bulkMode === "new" ? (
                  <section className="space-y-4">
                    <SectionHeading>New bulk item</SectionHeading>

                    <FormRow label="Item name" required>
                      <Input name="bulkName" placeholder="e.g. AA Batteries" required />
                    </FormRow>

                    <FormRow label="Category" required>
                      {categorySelect}
                    </FormRow>

                    <FormRow label="Location" required>
                      {locationSelect}
                    </FormRow>

                    <FormRow label="QR code" required>
                      <div className="flex gap-2">
                        <Input
                          value={bulkQrCode}
                          onChange={(e) => setBulkQrCode(e.target.value)}
                          placeholder="Bin QR code"
                          required
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          title="Generate QR code"
                          onClick={() => setBulkQrCode(generateQrCode())}
                        >
                          <Dices className="size-4" />
                        </Button>
                      </div>
                    </FormRow>

                    <FormRow label="Initial quantity">
                      <Input name="initialQuantity" type="number" min="0" defaultValue="0" />
                    </FormRow>
                  </section>
                ) : (
                  <section className="space-y-4">
                    <SectionHeading>Add to existing</SectionHeading>

                    {existingBulkSkus.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No bulk items found. Create one first.</p>
                    ) : (
                      <>
                        <FormRow label="Bulk item" required>
                          <Select value={selectedBulkSkuId} onValueChange={setSelectedBulkSkuId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a bulk item" />
                            </SelectTrigger>
                            <SelectContent>
                              {existingBulkSkus.map((sku) => {
                                const qty = sku.balances.reduce((sum, b) => sum + b.onHandQuantity, 0);
                                return (
                                  <SelectItem key={sku.id} value={sku.id}>
                                    {sku.name} — {qty} on hand ({sku.location.name})
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </FormRow>

                        {selectedBulkSkuId && (() => {
                          const sku = existingBulkSkus.find((s) => s.id === selectedBulkSkuId);
                          if (!sku) return null;
                          const qty = sku.balances.reduce((sum, b) => sum + b.onHandQuantity, 0);
                          return (
                            <div className="rounded-md border bg-muted/30 px-4 py-3 space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Current stock</span>
                                <span className="font-medium">{qty}</span>
                              </div>
                              {sku.categoryRel && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Category</span>
                                  <span>{sku.categoryRel.name}</span>
                                </div>
                              )}
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Location</span>
                                <span>{sku.location.name}</span>
                              </div>
                            </div>
                          );
                        })()}

                        <FormRow label="Add quantity" required>
                          <Input
                            type="number"
                            min="1"
                            value={addQty}
                            onChange={(e) => setAddQty(parseInt(e.target.value) || 1)}
                            required
                          />
                        </FormRow>
                      </>
                    )}
                  </section>
                )}
              </>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircleIcon className="size-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </form>
        </SheetBody>

        <SheetFooter>
          <div className="flex items-center gap-2">
            <Checkbox
              id="add-another"
              checked={addAnother}
              onCheckedChange={(v) => setAddAnother(!!v)}
            />
            <Label htmlFor="add-another" className="text-sm cursor-pointer">Add another</Label>
          </div>
          <div className="flex-1" />
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="new-item-form" disabled={submitting}>
            {submitting ? "Adding..." : "Add"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
