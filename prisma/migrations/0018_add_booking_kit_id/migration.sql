-- AlterTable
ALTER TABLE "bookings" ADD COLUMN "kit_id" TEXT;

-- CreateIndex
CREATE INDEX "bookings_kit_id_idx" ON "bookings"("kit_id");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_kit_id_fkey" FOREIGN KEY ("kit_id") REFERENCES "kits"("id") ON DELETE SET NULL ON UPDATE CASCADE;
