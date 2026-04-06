-- AlterTable: Add imageUrl to bulk_skus
ALTER TABLE "bulk_skus" ADD COLUMN "image_url" TEXT;

-- CreateTable: kit_bulk_memberships
CREATE TABLE "kit_bulk_memberships" (
    "id" TEXT NOT NULL,
    "kit_id" TEXT NOT NULL,
    "bulk_sku_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kit_bulk_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kit_bulk_memberships_kit_id_bulk_sku_id_key" ON "kit_bulk_memberships"("kit_id", "bulk_sku_id");

-- CreateIndex
CREATE INDEX "kit_bulk_memberships_bulk_sku_id_idx" ON "kit_bulk_memberships"("bulk_sku_id");

-- AddForeignKey
ALTER TABLE "kit_bulk_memberships" ADD CONSTRAINT "kit_bulk_memberships_kit_id_fkey" FOREIGN KEY ("kit_id") REFERENCES "kits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit_bulk_memberships" ADD CONSTRAINT "kit_bulk_memberships_bulk_sku_id_fkey" FOREIGN KEY ("bulk_sku_id") REFERENCES "bulk_skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
