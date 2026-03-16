-- Add human-readable reference number to bookings (CO-0001, RV-0002)
ALTER TABLE "bookings" ADD COLUMN "ref_number" TEXT;

-- Unique constraint
CREATE UNIQUE INDEX "bookings_ref_number_key" ON "bookings"("ref_number");

-- Global sequence for reference number generation
CREATE SEQUENCE booking_ref_seq START 1;

-- Backfill existing bookings in creation order
UPDATE "bookings"
SET "ref_number" = CASE
  WHEN "kind" = 'CHECKOUT' THEN 'CO-' || LPAD(nextval('booking_ref_seq')::TEXT, 4, '0')
  WHEN "kind" = 'RESERVATION' THEN 'RV-' || LPAD(nextval('booking_ref_seq')::TEXT, 4, '0')
  ELSE 'CO-' || LPAD(nextval('booking_ref_seq')::TEXT, 4, '0')
END
WHERE "status" != 'DRAFT';
