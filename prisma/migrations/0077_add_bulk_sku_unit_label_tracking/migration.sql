-- Add printed-label tracking to numbered bulk units.
ALTER TABLE "bulk_sku_units"
  ADD COLUMN "label_printed_at" TIMESTAMP(3),
  ADD COLUMN "label_printed_by_id" TEXT,
  ADD COLUMN "label_print_batch_id" TEXT;

CREATE INDEX "bulk_sku_units_bulk_sku_id_label_printed_at_idx"
  ON "bulk_sku_units"("bulk_sku_id", "label_printed_at");
