-- AlterTable: Add source_reservation_id to bookings for reservation-to-checkout conversion
ALTER TABLE "bookings" ADD COLUMN "source_reservation_id" TEXT REFERENCES "bookings"("id");

-- CreateIndex
CREATE INDEX "bookings_source_reservation_id_idx" ON "bookings"("source_reservation_id");
