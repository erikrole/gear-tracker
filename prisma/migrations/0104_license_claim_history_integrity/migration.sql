-- Reconcile manually applied License V2 fields with migration history, preserve
-- historical actor attribution, and enforce application-owned numeric and time
-- invariants at the database boundary. Every shape change is retry-safe because
-- the Neon HTTP migration fallback applies statements individually.

ALTER TYPE "LicenseCodeStatus" ADD VALUE IF NOT EXISTS 'PARTIAL';

ALTER TABLE "license_codes"
  ADD COLUMN IF NOT EXISTS "account_email" TEXT,
  ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP(3);

ALTER TABLE "license_code_claims"
  ADD COLUMN IF NOT EXISTS "occupant_label" TEXT;

ALTER TABLE "license_code_claims"
  ALTER COLUMN "user_id" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "license_codes_expires_at_idx"
  ON "license_codes"("expires_at");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "license_code_claims" claim
    LEFT JOIN "users" holder ON holder."id" = claim."user_id"
    WHERE claim."user_id" IS NOT NULL
      AND holder."id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot enforce license claim-holder integrity: orphaned user_id values exist';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "license_code_claims" claim
    LEFT JOIN "users" actor ON actor."id" = claim."released_by_id"
    WHERE claim."released_by_id" IS NOT NULL
      AND actor."id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot enforce license release actor integrity: orphaned released_by_id values exist';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "license_code_claims"
    WHERE "user_id" IS NOT NULL
      AND "released_at" IS NULL
    GROUP BY "user_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce one active license claim per user: duplicate active user claims exist';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "license_code_claims"
    WHERE "released_at" IS NULL
    GROUP BY "license_code_id"
    HAVING COUNT(*) > 2
  ) THEN
    RAISE EXCEPTION 'Cannot preserve two-slot license capacity: over-capacity codes exist';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "bulk_sku_units" unit
    LEFT JOIN "users" actor ON actor."id" = unit."label_printed_by_id"
    WHERE unit."label_printed_by_id" IS NOT NULL
      AND actor."id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot enforce bulk label actor integrity: orphaned label_printed_by_id values exist';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "bulk_skus"
    WHERE "min_threshold" < 0
  ) THEN
    RAISE EXCEPTION 'Cannot enforce bulk SKU threshold integrity: negative min_threshold values exist';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "bulk_stock_balances"
    WHERE "on_hand_quantity" < 0
  ) THEN
    RAISE EXCEPTION 'Cannot enforce bulk stock integrity: negative on_hand_quantity values exist';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "bulk_sku_units"
    WHERE "unit_number" <= 0
  ) THEN
    RAISE EXCEPTION 'Cannot enforce numbered-unit integrity: non-positive unit_number values exist';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "booking_bulk_items"
    WHERE "planned_quantity" <= 0
      OR "checked_out_quantity" < 0
      OR "checked_in_quantity" < 0
      OR "checked_out_quantity" > "planned_quantity"
      OR "checked_in_quantity" > "checked_out_quantity"
  ) THEN
    RAISE EXCEPTION 'Cannot enforce booking bulk quantity integrity: invalid custody quantities exist';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "bookings"
    WHERE "ends_at" <= "starts_at"
  ) THEN
    RAISE EXCEPTION 'Cannot enforce booking window integrity: non-positive booking windows exist';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "sport_shift_configs"
    WHERE "home_count" NOT BETWEEN 0 AND 20
      OR "away_count" NOT BETWEEN 0 AND 20
      OR "home_staff_count" NOT BETWEEN 0 AND 20
      OR "home_student_count" NOT BETWEEN 0 AND 20
      OR "away_staff_count" NOT BETWEEN 0 AND 20
      OR "away_student_count" NOT BETWEEN 0 AND 20
  ) THEN
    RAISE EXCEPTION 'Cannot enforce sport shift count integrity: counts outside 0 through 20 exist';
  END IF;
END
$$;

ALTER TABLE "license_code_claims"
  DROP CONSTRAINT IF EXISTS "license_code_claims_user_id_fkey",
  DROP CONSTRAINT IF EXISTS "license_code_claims_released_by_id_fkey",
  ADD CONSTRAINT "license_code_claims_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "license_code_claims_released_by_id_fkey"
  FOREIGN KEY ("released_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "license_code_claims_one_active_per_user"
  ON "license_code_claims"("user_id")
  WHERE "released_at" IS NULL AND "user_id" IS NOT NULL;

DROP INDEX IF EXISTS "license_code_one_active_per_user";

CREATE INDEX IF NOT EXISTS "license_code_claims_released_by_id_idx"
  ON "license_code_claims"("released_by_id");

ALTER TABLE "bulk_sku_units"
  DROP CONSTRAINT IF EXISTS "bulk_sku_units_label_printed_by_id_fkey",
  DROP CONSTRAINT IF EXISTS "bulk_sku_units_unit_number_check",
  ADD CONSTRAINT "bulk_sku_units_label_printed_by_id_fkey"
  FOREIGN KEY ("label_printed_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "bulk_sku_units_unit_number_check"
  CHECK ("unit_number" > 0);

CREATE INDEX IF NOT EXISTS "bulk_sku_units_label_printed_by_id_idx"
  ON "bulk_sku_units"("label_printed_by_id");

ALTER TABLE "bulk_skus"
  DROP CONSTRAINT IF EXISTS "bulk_skus_min_threshold_check",
  ADD CONSTRAINT "bulk_skus_min_threshold_check"
  CHECK ("min_threshold" >= 0);

ALTER TABLE "bulk_stock_balances"
  DROP CONSTRAINT IF EXISTS "bulk_stock_balances_on_hand_quantity_check",
  ADD CONSTRAINT "bulk_stock_balances_on_hand_quantity_check"
  CHECK ("on_hand_quantity" >= 0);

ALTER TABLE "booking_bulk_items"
  DROP CONSTRAINT IF EXISTS "booking_bulk_items_quantity_check",
  ADD CONSTRAINT "booking_bulk_items_quantity_check"
  CHECK (
    "planned_quantity" > 0
    AND "checked_out_quantity" >= 0
    AND "checked_in_quantity" >= 0
    AND "checked_out_quantity" <= "planned_quantity"
    AND "checked_in_quantity" <= "checked_out_quantity"
  );

ALTER TABLE "bookings"
  DROP CONSTRAINT IF EXISTS "bookings_time_window_check",
  ADD CONSTRAINT "bookings_time_window_check"
  CHECK ("ends_at" > "starts_at");

ALTER TABLE "sport_shift_configs"
  DROP CONSTRAINT IF EXISTS "sport_shift_configs_count_range_check",
  ADD CONSTRAINT "sport_shift_configs_count_range_check"
  CHECK (
    "home_count" BETWEEN 0 AND 20
    AND "away_count" BETWEEN 0 AND 20
    AND "home_staff_count" BETWEEN 0 AND 20
    AND "home_student_count" BETWEEN 0 AND 20
    AND "away_staff_count" BETWEEN 0 AND 20
    AND "away_student_count" BETWEEN 0 AND 20
  );
