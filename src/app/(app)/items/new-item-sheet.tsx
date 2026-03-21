"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2Icon, Dices, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
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

/** Brief success flash shown after "Add another" creates an item. */
function SuccessFlash({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
      <CheckCircle2Icon className="size-4 shrink-0" />
      {message}
    </div>
  );
}

/** Generate a random QR code value matching the app's format: QR-XXXXXXXX */
function generateQrCode(): string {
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  const hex = Array.from(array).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `QR-${hex}`;
}

/** Detect if the user is likely on a mobile device with a camera. */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    setIsMobile(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
  }, []);
  return isMobile;
}

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

  // Controlled select values (Select doesn't work with native FormData)
  const [categoryId, setCategoryId] = useState("__none__");
  const [locationId, setLocationId] = useState("");
  const [departmentId, setDepartmentId] = useState("__none__");

  // QR code field — controlled so generate/scan can populate it
  const [qrCodeValue, setQrCodeValue] = useState("");
  const [showScanner, setShowScanner] = useState(false);

  const isMobile = useIsMobile();
  const formRef = useRef<HTMLFormElement>(null);

  // Full reset — closing the sheet
  const resetAll = useCallback(() => {
    setError("");
    setSuccessMsg("");
    setCategoryId("__none__");
    setLocationId("");
    setDepartmentId("__none__");
    setQrCodeValue("");
    setShowScanner(false);
    setKind("serialized");
  }, []);

  // Partial reset — "add another" keeps location, category, department, kind
  function resetForAnother() {
    setError("");
    setQrCodeValue("");
    setShowScanner(false);
  }

  function showSuccessMsg(msg: string) {
    setSuccessMsg(msg);
    clearTimeout(successTimer.current);
    successTimer.current = setTimeout(() => setSuccessMsg(""), 3000);
  }

  // Cleanup timer on unmount
  useEffect(() => () => clearTimeout(successTimer.current), []);

  // Validate controlled selects that HTML5 validation can't reach
  function validateSelects(): string | null {
    if (kind === "serialized") {
      if (!categoryId || categoryId === "__none__") return "Please select a category.";
      if (!departmentId || departmentId === "__none__") return "Please select a department.";
    }
    if (!locationId) return "Please select a location.";
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
        const desc = String(form.get("description") || "").trim();
        const fiscalYear = String(form.get("fiscalYear") || "").trim();
        if (desc) notes.description = desc;
        if (fiscalYear) notes.fiscalYear = fiscalYear;

        const resolvedCategoryId = categoryId === "__none__" ? "" : categoryId;
        const resolvedDepartmentId = departmentId === "__none__" ? "" : departmentId;
        const itemName = String(form.get("itemName") || "").trim();
        const purchasePriceStr = String(form.get("purchasePrice") || "").trim();
        const residualValueStr = String(form.get("residualValue") || "").trim();
        const assetTag = String(form.get("assetTag") || "");
        const serialNumber = String(form.get("serialNumber") || "").trim();

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
      } else {
        const resolvedCategoryId = categoryId === "__none__" ? "" : categoryId;
        const bulkName = String(form.get("bulkName") || "");
        res = await fetch("/api/bulk-skus", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: bulkName,
            category: "general",
            ...(resolvedCategoryId ? { categoryId: resolvedCategoryId } : {}),
            unit: String(form.get("unit") || ""),
            locationId,
            binQrCodeValue: String(form.get("binQrCodeValue") || ""),
            initialQuantity: parseInt(String(form.get("initialQuantity") || "0"), 10),
            minThreshold: parseInt(String(form.get("minThreshold") || "0"), 10),
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

  const categorySelect = (
    <Select value={categoryId} onValueChange={setCategoryId}>
      <SelectTrigger>
        <SelectValue placeholder="Select a category" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">No category</SelectItem>
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
          <form id="new-item-form" ref={formRef} onSubmit={handleSubmit} className="space-y-8">
            {/* Section 1: Item type */}
            <section className="space-y-4">
              <h3 className="text-base font-semibold">How do you want this item to be added?</h3>

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

            {/* Section 2: Item details */}
            <section className="space-y-4">
              <h3 className="text-base font-semibold">Item details</h3>

              {successMsg && <SuccessFlash message={successMsg} />}

              {kind === "serialized" ? (
                <>
                  <FormRow label="Name" required>
                    <Input name="itemName" placeholder="e.g. Sony A7III Camera" required />
                  </FormRow>

                  <FormRow2Col label="Brand / Model" required>
                    <Input name="brand" placeholder="e.g. Sony" required />
                    <Input name="model" placeholder="e.g. A7III" required />
                  </FormRow2Col>

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

                  <FormRow label="Asset tag" required>
                    <Input name="assetTag" placeholder="Unique tag name" required />
                  </FormRow>

                  <FormRow label="Serial number">
                    <Input name="serialNumber" placeholder="Serial number (optional)" />
                  </FormRow>

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

                  <Separator />

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

                  <FormRow label="Link">
                    <Input name="linkUrl" type="url" placeholder="https://..." />
                  </FormRow>

                  <FormRow label="UW Asset Tag">
                    <Input name="uwAssetTag" placeholder="0" />
                  </FormRow>

                  <FormRow label="Fiscal Year">
                    <Input name="fiscalYear" placeholder="e.g. 2025" />
                  </FormRow>

                  <FormRow label="Description">
                    <Input name="description" placeholder="Optional notes" />
                  </FormRow>
                </>
              ) : (
                <>
                  <FormRow label="Product name" required>
                    <Input name="bulkName" placeholder="e.g. AA Batteries" required />
                  </FormRow>

                  <FormRow label="Category">
                    {categorySelect}
                  </FormRow>

                  <FormRow label="Location" required>
                    {locationSelect}
                  </FormRow>

                  <FormRow label="Unit" required>
                    <Input name="unit" placeholder="ea, box, pack" required />
                  </FormRow>
                  <FormRow label="Bin QR code" required>
                    <Input name="binQrCodeValue" placeholder="QR code on storage bin" required />
                  </FormRow>
                  <FormRow2Col label="Stock">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Initial quantity</Label>
                      <Input name="initialQuantity" type="number" min="0" defaultValue="0" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Min threshold</Label>
                      <Input name="minThreshold" type="number" min="0" defaultValue="0" />
                    </div>
                  </FormRow2Col>
                </>
              )}
            </section>

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
