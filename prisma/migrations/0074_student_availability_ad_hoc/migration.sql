-- Extend student availability blocks to support semester-bounded weekly blocks
-- and one-time ad hoc conflicts without changing existing weekly rows.

CREATE TYPE "StudentAvailabilityKind" AS ENUM ('WEEKLY', 'AD_HOC');

ALTER TABLE "student_availability_blocks"
  ADD COLUMN "kind" "StudentAvailabilityKind" NOT NULL DEFAULT 'WEEKLY',
  ADD COLUMN "date" DATE,
  ADD COLUMN "semester_starts_on" DATE,
  ADD COLUMN "semester_ends_on" DATE,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "day_of_week" DROP NOT NULL;

CREATE INDEX "student_availability_blocks_kind_date_idx"
  ON "student_availability_blocks"("kind", "date");

CREATE INDEX "student_availability_blocks_user_id_kind_idx"
  ON "student_availability_blocks"("user_id", "kind");
