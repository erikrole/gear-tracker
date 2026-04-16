-- AlterTable: Add new fields to bulk_skus
ALTER TABLE "bulk_skus" ADD COLUMN "department_id" TEXT,
                         ADD COLUMN "purchase_price" DECIMAL(10,2),
                         ADD COLUMN "purchase_link" TEXT,
                         ADD COLUMN "notes" TEXT;

-- CreateIndex
CREATE INDEX "bulk_skus_department_id_idx" ON "bulk_skus"("department_id");

-- AddForeignKey
ALTER TABLE "bulk_skus" ADD CONSTRAINT "bulk_skus_department_id_fkey"
  FOREIGN KEY ("department_id") REFERENCES "departments"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
