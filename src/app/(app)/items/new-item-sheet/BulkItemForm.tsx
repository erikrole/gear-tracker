"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Dices } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import type { BulkMode, BulkSkuOption, CategoryOption, Location } from "./types";
import { generateQrCode } from "./helpers";
import { FormRow, SectionHeading } from "./layout";
import { FormCombobox, CategoryCombobox, BulkSkuCombobox } from "./FormCombobox";

export interface BulkFormHandle {
  validate(): string | null;
  getSubmitPayload(): { url: string; body: Record<string, unknown>; label: string } | null;
  reset(): void;
}

interface Props {
  categories: CategoryOption[];
  locations: Location[];
  open: boolean;
}

export const BulkItemForm = forwardRef<BulkFormHandle, Props>(
  function BulkItemForm({ categories, locations, open }, ref) {
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

    const locationOptions = locations.map((l) => ({ value: l.id, label: l.name }));

    // Fetch existing bulk SKUs when open
    useEffect(() => {
      if (!open) return;
      (async () => {
        try {
          const res = await fetch("/api/bulk-skus");
          const json = await res.json();
          if (res.ok) setExistingBulkSkus(json.data || []);
        } catch {
          // ignore
        }
      })();
    }, [open]);

    useImperativeHandle(ref, () => ({
      validate() {
        if (bulkMode === "new") {
          if (!bulkName.trim()) return "Bulk item name is required.";
          if (!categoryId) return "Please select a category.";
          if (!locationId) return "Please select a location.";
          if (!bulkQrCode.trim()) return "QR code is required.";
        } else {
          if (!selectedBulkSkuId) return "Please select a bulk item.";
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
            label: sku?.name || "Bulk item",
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
          },
          label: bulkName.trim() || "Bulk item",
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
    }));

    return (
      <>
        {/* ── Bulk sub-mode ── */}
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
              <Input value={bulkName} onChange={(e) => setBulkName(e.target.value)} placeholder="e.g. AA Batteries" required />
            </FormRow>

            <FormRow label="Category" required>
              <CategoryCombobox value={categoryId} onValueChange={setCategoryId} categories={categories} />
            </FormRow>

            <FormRow label="Location" required>
              <FormCombobox
                value={locationId}
                onValueChange={setLocationId}
                options={locationOptions}
                placeholder="Select a location"
                searchPlaceholder="Search locations..."
                emptyLabel="No location found."
              />
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
              <Input value={initialQuantity} onChange={(e) => setInitialQuantity(e.target.value)} type="number" min="0" />
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
    );
  }
);
