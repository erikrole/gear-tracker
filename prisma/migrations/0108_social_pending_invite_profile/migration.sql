ALTER TYPE "ShiftArea" ADD VALUE IF NOT EXISTS 'SOCIAL';

ALTER TABLE "allowed_emails"
  ADD COLUMN IF NOT EXISTS "preloaded_name" TEXT,
  ADD COLUMN IF NOT EXISTS "preloaded_primary_area" "ShiftArea",
  ADD COLUMN IF NOT EXISTS "preloaded_areas" "ShiftArea"[] NOT NULL DEFAULT ARRAY[]::"ShiftArea"[],
  ADD COLUMN IF NOT EXISTS "preloaded_sport_codes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
