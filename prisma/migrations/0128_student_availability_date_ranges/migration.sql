-- Let one-time availability represent an inclusive date range and all-day time away.
-- Existing single-date and timed rows remain valid; a null date_ends_on is treated
-- as the same day as date by the application conflict helper.

ALTER TABLE "student_availability_blocks"
  ADD COLUMN "date_ends_on" DATE,
  ADD COLUMN "all_day" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "student_availability_blocks_kind_date_date_ends_on_idx"
  ON "student_availability_blocks"("kind", "date", "date_ends_on");
