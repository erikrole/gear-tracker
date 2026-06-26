CREATE TABLE "favorite_item_families" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "bulk_sku_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "favorite_item_families_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "favorite_item_families_user_id_bulk_sku_id_key"
ON "favorite_item_families"("user_id", "bulk_sku_id");

CREATE INDEX "favorite_item_families_user_id_idx"
ON "favorite_item_families"("user_id");

CREATE INDEX "favorite_item_families_bulk_sku_id_idx"
ON "favorite_item_families"("bulk_sku_id");

ALTER TABLE "favorite_item_families"
ADD CONSTRAINT "favorite_item_families_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "favorite_item_families"
ADD CONSTRAINT "favorite_item_families_bulk_sku_id_fkey"
FOREIGN KEY ("bulk_sku_id") REFERENCES "bulk_skus"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
