-- Planned Staff/Student shift staffing plus layered call-time overrides.
-- Existing total home/away counts become Student counts so current generated
-- coverage totals do not change after the migration.

ALTER TABLE "sport_shift_configs"
  ADD COLUMN "home_staff_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "home_student_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "away_staff_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "away_student_count" INTEGER NOT NULL DEFAULT 0;

UPDATE "sport_shift_configs"
SET
  "home_student_count" = "home_count",
  "away_student_count" = "away_count";

ALTER TABLE "sport_shift_configs"
  ALTER COLUMN "home_student_count" SET DEFAULT 1,
  ALTER COLUMN "away_student_count" SET DEFAULT 1;

ALTER TABLE "shifts"
  ADD COLUMN "call_starts_at" TIMESTAMP(3),
  ADD COLUMN "call_ends_at" TIMESTAMP(3);

ALTER TABLE "shift_assignments"
  ADD COLUMN "call_starts_at" TIMESTAMP(3),
  ADD COLUMN "call_ends_at" TIMESTAMP(3),
  ADD COLUMN "call_note" TEXT;
