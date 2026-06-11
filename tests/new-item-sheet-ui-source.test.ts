import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Add item sheet booking-inspired UI", () => {
  it("keeps the compact tracking summary and review-style handoff", () => {
    const source = readFileSync("src/app/(app)/items/new-item-sheet.tsx", "utf8");

    expect(source).toContain("KIND_OPTIONS");
    expect(source).toContain("Creates one item record that can be reserved, checked out, and found by QR.");
    expect(source).toContain("Creates a family record plus numbered units for kiosk pickup and return.");
    expect(source).toContain("Creates or updates one stock record and tracks the count on hand.");
    expect(source).toContain("SummaryRow label=\"Status\"");
    expect(source).toContain("SummaryRow label=\"Tracking\"");
    expect(source).toContain("SummaryRow label=\"Next\"");
    expect(source).toContain("shadow-[0_12px_50px_rgba(0,0,0,0.05)]");
  });

  it("keeps booking-style section cards inside the item forms", () => {
    const sectionSource = readFileSync("src/app/(app)/items/new-item-sheet/FormSection.tsx", "utf8");
    const standardSource = readFileSync("src/app/(app)/items/new-item-sheet/SerializedItemForm.tsx", "utf8");
    const bulkSource = readFileSync("src/app/(app)/items/new-item-sheet/BulkItemForm.tsx", "utf8");

    expect(sectionSource).toContain("rounded-xl border border-border/50 bg-background/90 p-4 shadow-xs");
    expect(standardSource).toContain('title="Identity"');
    expect(standardSource).toContain('badge="Fast intake"');
    expect(standardSource).toContain('title="Tracking"');
    expect(standardSource).toContain('badge="Scan identity"');
    expect(bulkSource).toContain('title="Quantity option"');
    expect(bulkSource).toContain('badge="Stock mode"');
    expect(bulkSource).toContain('title="Add to existing"');
  });

  it("keeps Add item form fields label-associated and autofill-quiet", () => {
    const comboboxSource = readFileSync("src/components/FormCombobox.tsx", "utf8");
    const standardSource = readFileSync("src/app/(app)/items/new-item-sheet/SerializedItemForm.tsx", "utf8");
    const bulkSource = readFileSync("src/app/(app)/items/new-item-sheet/BulkItemForm.tsx", "utf8");

    expect(comboboxSource).toContain("id?: string;");
    expect(comboboxSource).toContain("id={id}");
    expect(standardSource).toContain('label="Asset tag" htmlFor="new-item-asset-tag"');
    expect(standardSource).toContain('label="Category" htmlFor="new-item-category"');
    expect(standardSource).toContain('htmlFor="new-item-is-accessory"');
    expect(standardSource).toContain('htmlFor="new-item-available-for-reservation"');
    expect(standardSource).toContain('label="Photo upload" htmlFor="new-item-photo"');
    expect(standardSource).toContain('name="imageFile"');
    expect(standardSource).toContain('Price (USD)');
    expect(standardSource).toContain("assetTagSummary && assetTag.trim()");
    expect(standardSource).toContain("setTimeout(async () =>");
    expect(standardSource).toContain("Suggested next tag");
    expect(standardSource).toContain('autoComplete="off"');
    expect(bulkSource).toContain('label="Item name" htmlFor="new-bulk-item-name"');
    expect(bulkSource).toContain('label="Item" htmlFor="existing-bulk-item"');
    expect(bulkSource).toContain('aria-label="Generate QR code"');
  });

  it("excludes unit-tracked families from the Quantity add-to-existing selector", () => {
    const bulkSource = readFileSync("src/app/(app)/items/new-item-sheet/BulkItemForm.tsx", "utf8");

    // The add-to-existing path must only target quantity-tracked families so it never
    // routes unit-tracked stock through /adjust (which skips BulkSkuUnit creation).
    expect(bulkSource).toContain("existingBulkSkus.filter((sku) => !sku.trackByNumber)");
    expect(bulkSource).toContain("skus={quantityOnlyBulkSkus}");
    expect(bulkSource).toContain("quantityOnlyBulkSkus.find((s) => s.id === selectedBulkSkuId)");
    expect(bulkSource).toContain("quantityOnlyBulkSkus.length === 0");
  });
});
