CREATE TYPE "AccountabilityExclusionReason" AS ENUM (
  'TEST_DATA',
  'IMPORTED_BAD_DATA',
  'INCORRECT_TIMESTAMPS',
  'DUPLICATE_RECORD',
  'OTHER'
);

CREATE TABLE "booking_accountability_exclusions" (
  "id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "reason" "AccountabilityExclusionReason" NOT NULL,
  "note" TEXT,
  "excluded_by_user_id" TEXT NOT NULL,
  "excluded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "restored_by_user_id" TEXT,
  "restored_at" TIMESTAMP(3),

  CONSTRAINT "booking_accountability_exclusions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "booking_accountability_exclusions_booking_id_key"
  ON "booking_accountability_exclusions"("booking_id");
CREATE INDEX "booking_accountability_exclusions_restored_at_excluded_at_idx"
  ON "booking_accountability_exclusions"("restored_at", "excluded_at");
CREATE INDEX "booking_accountability_exclusions_excluded_by_user_id_idx"
  ON "booking_accountability_exclusions"("excluded_by_user_id");
CREATE INDEX "booking_accountability_exclusions_restored_by_user_id_idx"
  ON "booking_accountability_exclusions"("restored_by_user_id");

ALTER TABLE "booking_accountability_exclusions"
  ADD CONSTRAINT "booking_accountability_exclusions_booking_id_fkey"
  FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "booking_accountability_exclusions"
  ADD CONSTRAINT "booking_accountability_exclusions_excluded_by_user_id_fkey"
  FOREIGN KEY ("excluded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "booking_accountability_exclusions"
  ADD CONSTRAINT "booking_accountability_exclusions_restored_by_user_id_fkey"
  FOREIGN KEY ("restored_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
