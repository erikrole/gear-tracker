"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Dices } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import type { BulkMode, Location } from "./types";
import type { CategoryOption } from "@/types/category";
import { generateQrCode } from "./helpers";
import { FormRow, SectionHeading } from "@/components/form-layout";
import { FormCombobox, CategoryCombobox, BulkSkuCombobox, type BulkSkuOption } from "@/components/FormCombobox";
import { handleAuthRedirect, parseJsonSafely } from "@/lib/errors";

export interface BulkFormHandle {
  validate(): string | null;
  getSubmitPayload(): { url: string; body: Record<string, unknown>; label: string; handoffHref?: string; openLabel?: string } | null;
  reset(): void;
  focus(): void;
}

interface Props {
  categories: CategoryOption[];
  locations: Location[];
  open: boolean;
  trackingMode: "units" | "quantity";
  disabled?: boolean;
}

type BulkSkuListResponse = {
  data?: BulkSkuOption[];
};

export const BulkItemForm = forwardRef<BulkFormHandle, Props>(
  function BulkItemForm({ categories, locations, open, trackingMode, disabled = false }, ref) {
    const [bulkMode, setBulkMode] = useState<BulkMode>("new");

    // New bulk SKU fields — empty string = no selection
    const [bulkName, setBulkName] = useState("");
    const [categoryId, setCategoryId] = useState("");
    const [locationId, setLocationId] = useState("");
    const [bulkQrCode, setBulkQrCode] = useState("");
    const [initialQuantity, setInitialQuantity] = useState("0");

    // Existing bulk SKU fields
    const [existingBulkSkus, setExistingBulkSkus] = useState<BulkSkuOption[]>([]);
    const [selectedBulkSkuId, setSelectedBulkSkuId] = useState("");
    const [addQty, setAddQty] = useState(1);

    const bulkNameInputRef = useRef<HTMLInputElement>(null);

    const locationOptions = locations.map((l) => ({ value: l.id, label: l.name }));

    // Fetch existing bulk SKUs when open
    useEffect(() => {
      if (!open) return;
      const controller = new AbortController();
      (async () => {
        try {
          const res = await fetch("/api/bulk-skus", { signal: controller.signal });
          if (handleAuthRedirect(res)) return;
          if (!res.ok) return;
          const json = await parseJsonSafely<BulkSkuListResponse>(res);
          if (!controller.signal.aborted) setExistingBulkSkus(Array.isArray(json?.data) ? json.data : []);
        } catch {
          // ignore
        }
      })();
      return () => controller.abort();
    }, [open]);

    useEffect(() => {
      if (trackingMode === "units") setBulkMode("new");
    }, [trackingMode]);

    useImperativeHandle(ref, () => ({
      validate() {
        if (bulkMode === "new") {
          if (!bulkName.trim()) return "Item name is required.";
          if (!categoryId) return "Please select a category.";
          if (!locationId) return "Please select a location.";
          if (!bulkQrCode.trim()) return "QR code is required.";
        } else {
          if (!selectedBulkSkuId) return "Please select an item.";
          if (addQty < 1) return "Quantity must be at least 1.";
        }
        return null;
      },
      getSubmitPayload() {
        if (bulkMode === "existing") {
          const sku = existingBulkSkus.find((s) => s.id === selectedBulkSkuId);
          return {
            url: `/api/bulk-skus/${selectedBulkSkuId}/adjust`,
            body: { quantityDelta: addQty, reason: "Added via New Item sheet" },
            label: sku?.name || "Item",
            handoffHref: `/items/bulk-${selectedBulkSkuId}`,
            openLabel: "Open item",
          };
        }
        return {
          url: "/api/bulk-skus",
          body: {
            name: bulkName.trim(),
            category: "general",
            ...(categoryId ? { categoryId } : {}),
            locationId,
            binQrCodeValue: bulkQrCode.trim(),
            initialQuantity: parseInt(initialQuantity, 10) || 0,
            trackByNumber: trackingMode === "units",
          },
          label: bulkName.trim() || "Item",
          openLabel: "Open item",
        };
      },
      reset() {
        setBulkMode("new");
        setBulkName("");
        setCategoryId("");
        setLocationId("");
        setBulkQrCode("");
        setInitialQuantity("0");
        setSelectedBulkSkuId("");
        setAddQty(1);
      },
      focus() {
        bulkNameInputRef.current?.focus();
      },
    }));

    return (
      <fieldset disabled={disabled} className="contents">
        {trackingMode === "quantity" && (
          <>
            <section className="space-y-3">
              <SectionHeading>Quantity option</SectionHeading>
              <RadioGroup name="bulk-mode" value={bulkMode} onValueChange={(v) => setBulkMode(v as BulkMode)} disabled={disabled}>
                <div className="flex items-start gap-3">
                  <RadioGroupItem value="new" id="bulk-new" className="mt-0.5" />
                  <div>
                    <Label htmlFor="bulk-new" className="font-medium cursor-pointer">Create new item</Label>
                    <p className="text-xs text-muted-foreground">Add one catalog row for a count-tracked item.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <RadioGroupItem value="existing" id="bulk-existing" className="mt-0.5" />
                  <div>
                    <Label htmlFor="bulk-existing" className="font-medium cursor-pointer">Add to existing</Label>
                    <p className="text-xs text-muted-foreground">Add more stock to an item you already manage.</p>
                  </div>
                </div>
              </RadioGroup>
            </section>

            <Separator />
          </>
        )}

        {bulkMode === "new" ? (
          <section className="space-y-4">
            <SectionHeading>{trackingMode === "units" ? "New unit item" : "New quantity item"}</SectionHeading>

            <FormRow label="Item name" required>
              <Input
                id="new-bulk-item-name"
                name="bulkName"
                ref={bulkNameInputRef}
                value={bulkName}
                onChange={(e) => setBulkName(e.target.value)}
                placeholder={trackingMode === "units" ? "e.g. Sony BP-U70 Battery" : "e.g. Gaff Tape"}
                required
              />
            </FormRow>

            <FormRow label="Category" required>
              <CategoryCombobox value={categoryId} onValueChange={setCategoryId} categories={categories} disabled={disabled} />
            </FormRow>

            <FormRow label="Location" required>
              <FormCombobox
                value={locationId}
                onValueChange={setLocationId}
                options={locationOptions}
                placeholder="Select a location"
                searchPlaceholder="Search locations..."
                emptyLabel="No location found."
                disabled={disabled}
              />
            </FormRow>

            <FormRow label={trackingMode === "units" ? "Family QR code" : "Stock QR code"} required>
              <div className="flex gap-2">
                <Input
                  id="new-bulk-item-qr-code"
                  name="bulkQrCode"
                  value={bulkQrCode}
                  onChange={(e) => setBulkQrCode(e.target.value)}
                  placeholder={trackingMode === "units" ? "Family QR code" : "Stock QR code"}
                  required
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="Generate QR code"
                  onClick={() => setBulkQrCode(generateQrCode())}
                  disabled={disabled}
                >
                  <Dices className="size-4" />
                </Button>
              </div>
            </FormRow>

            <FormRow label={trackingMode === "units" ? "Initial units" : "Initial quantity"}>
              <Input id="new-bulk-item-initial-quantity" name="initialQuantity" value={initialQuantity} onChange={(e) => setInitialQuantity(e.target.value)} type="number" min="0" />
            </FormRow>
            {trackingMode === "units" && (
              <p className="text-xs text-muted-foreground">
                The initial count creates numbered units under this item. Exact units are scanned during pickup and return.
              </p>
            )}
          </section>
        ) : (
          <section className="space-y-4">
            <SectionHeading>Add to existing</SectionHeading>

            {existingBulkSkus.length === 0 ? (
              <p className="text-sm text-muted-foreground">No quantity items found. Create one first.</p>
            ) : (
              <>
                <FormRow label="Item" required>
                  <BulkSkuCombobox
                    value={selectedBulkSkuId}
                    onValueChange={setSelectedBulkSkuId}
                    skus={existingBulkSkus}
                  />
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
                    id="existing-bulk-item-add-quantity"
                    name="addQuantity"
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
      </fieldset>
    );
  }
);
