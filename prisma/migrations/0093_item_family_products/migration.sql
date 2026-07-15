CREATE TABLE "bulk_sku_products" (
  "id" TEXT NOT NULL,
  "bulk_sku_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalized_name" TEXT NOT NULL,
  "brand" TEXT NOT NULL,
  "model" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "bulk_sku_products_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "bulk_sku_units"
  ADD COLUMN "product_id" TEXT;

CREATE UNIQUE INDEX "bulk_sku_products_bulk_sku_id_normalized_name_key"
  ON "bulk_sku_products"("bulk_sku_id", "normalized_name");

CREATE INDEX "bulk_sku_products_bulk_sku_id_active_idx"
  ON "bulk_sku_products"("bulk_sku_id", "active");

CREATE INDEX "bulk_sku_units_product_id_idx"
  ON "bulk_sku_units"("product_id");

ALTER TABLE "bulk_sku_products"
  ADD CONSTRAINT "bulk_sku_products_bulk_sku_id_fkey"
  FOREIGN KEY ("bulk_sku_id") REFERENCES "bulk_skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bulk_sku_units"
  ADD CONSTRAINT "bulk_sku_units_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "bulk_sku_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
