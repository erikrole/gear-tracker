-- CreateEnum
CREATE TYPE "BulkUnitStatus" AS ENUM ('AVAILABLE', 'CHECKED_OUT', 'LOST', 'RETIRED');

-- AlterTable
ALTER TABLE "bulk_skus" ADD COLUMN "track_by_number" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "bulk_sku_units" (
    "id" TEXT NOT NULL,
    "bulk_sku_id" TEXT NOT NULL,
    "unit_number" INTEGER NOT NULL,
    "status" "BulkUnitStatus" NOT NULL DEFAULT 'AVAILABLE',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bulk_sku_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_bulk_unit_allocations" (
    "id" TEXT NOT NULL,
    "booking_bulk_item_id" TEXT NOT NULL,
    "bulk_sku_unit_id" TEXT NOT NULL,
    "checked_out_at" TIMESTAMP(3),
    "checked_in_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_bulk_unit_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bulk_sku_units_bulk_sku_id_unit_number_key" ON "bulk_sku_units"("bulk_sku_id", "unit_number");

-- CreateIndex
CREATE INDEX "bulk_sku_units_bulk_sku_id_status_idx" ON "bulk_sku_units"("bulk_sku_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "booking_bulk_unit_allocations_booking_bulk_item_id_bulk_sku_u_key" ON "booking_bulk_unit_allocations"("booking_bulk_item_id", "bulk_sku_unit_id");

-- CreateIndex
CREATE INDEX "booking_bulk_unit_allocations_bulk_sku_unit_id_idx" ON "booking_bulk_unit_allocations"("bulk_sku_unit_id");

-- AddForeignKey
ALTER TABLE "bulk_sku_units" ADD CONSTRAINT "bulk_sku_units_bulk_sku_id_fkey" FOREIGN KEY ("bulk_sku_id") REFERENCES "bulk_skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_bulk_unit_allocations" ADD CONSTRAINT "booking_bulk_unit_allocations_booking_bulk_item_id_fkey" FOREIGN KEY ("booking_bulk_item_id") REFERENCES "booking_bulk_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_bulk_unit_allocations" ADD CONSTRAINT "booking_bulk_unit_allocations_bulk_sku_unit_id_fkey" FOREIGN KEY ("bulk_sku_unit_id") REFERENCES "bulk_sku_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
