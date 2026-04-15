-- Harden bulk item quantity fields: change nullable Int? to Int @default(0)
-- First coerce any NULL values, then make columns NOT NULL with a default.

UPDATE "booking_bulk_items" SET "checked_out_quantity" = 0 WHERE "checked_out_quantity" IS NULL;
UPDATE "booking_bulk_items" SET "checked_in_quantity" = 0 WHERE "checked_in_quantity" IS NULL;

ALTER TABLE "booking_bulk_items" ALTER COLUMN "checked_out_quantity" SET NOT NULL;
ALTER TABLE "booking_bulk_items" ALTER COLUMN "checked_out_quantity" SET DEFAULT 0;
ALTER TABLE "booking_bulk_items" ALTER COLUMN "checked_in_quantity" SET NOT NULL;
ALTER TABLE "booking_bulk_items" ALTER COLUMN "checked_in_quantity" SET DEFAULT 0;
