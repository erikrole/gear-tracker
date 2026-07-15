import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  cleanItemFamilyProductText,
  cleanOptionalItemFamilyProductText,
  normalizeItemFamilyProductName,
} from "@/lib/item-family-products";

describe("item-family product identity", () => {
  it("normalizes duplicate product names without changing display copy", () => {
    expect(cleanItemFamilyProductText("  Watson   NP-F550 ")).toBe("Watson NP-F550");
    expect(normalizeItemFamilyProductName("  WATSON   NP-F550 ")).toBe("watson np-f550");
    expect(cleanOptionalItemFamilyProductText("   ")).toBeNull();
  });

  it("pins products beneath one family and leaves unit QR identity family-scoped", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    const migration = readFileSync("prisma/migrations/0093_item_family_products/migration.sql", "utf8");
    const qr = readFileSync("src/lib/bulk-unit-qr.ts", "utf8");

    expect(schema).toMatch(/model BulkSkuProduct[\s\S]*bulkSkuId[\s\S]*normalizedName[\s\S]*units\s+BulkSkuUnit\[\]/);
    expect(schema).toMatch(/model BulkSkuUnit[\s\S]*productId\s+String\?[\s\S]*product\s+BulkSkuProduct\?/);
    expect(migration).toContain('CREATE TABLE "bulk_sku_products"');
    expect(migration).toContain('ADD COLUMN "product_id" TEXT');
    expect(migration).toContain("ON DELETE SET NULL");
    expect(qr).toContain("`${trimmed}-${unitNumber}`");
    expect(qr).not.toContain("productId");
  });
});
