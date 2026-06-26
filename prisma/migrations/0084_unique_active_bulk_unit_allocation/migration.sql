-- Prevent a numbered bulk unit from being actively checked out on more than
-- one booking at the same time. Returned historical allocations remain allowed.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "booking_bulk_unit_allocations"
    WHERE "checked_out_at" IS NOT NULL
      AND "checked_in_at" IS NULL
    GROUP BY "bulk_sku_unit_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot create active bulk unit allocation constraint: duplicate active allocations exist';
  END IF;
END $$;

CREATE UNIQUE INDEX "booking_bulk_unit_allocations_one_active_unit_key"
ON "booking_bulk_unit_allocations"("bulk_sku_unit_id")
WHERE "checked_out_at" IS NOT NULL
  AND "checked_in_at" IS NULL;
