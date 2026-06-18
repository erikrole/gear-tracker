-- Extend student availability into advisory preferences and time-off requests.
-- Existing weekly/ad hoc rows remain approved cannot-work blocks.

CREATE TYPE "StudentAvailabilityIntent" AS ENUM ('CANNOT_WORK', 'PREFER', 'DISLIKE', 'TIME_OFF');
CREATE TYPE "StudentAvailabilityStatus" AS ENUM ('APPROVED', 'PENDING', 'DENIED');

ALTER TABLE "student_availability_blocks"
  ADD COLUMN "intent" "StudentAvailabilityIntent" NOT NULL DEFAULT 'CANNOT_WORK',
  ADD COLUMN "status" "StudentAvailabilityStatus" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN "reviewed_at" TIMESTAMP(3),
  ADD COLUMN "reviewed_by_id" TEXT,
  ADD COLUMN "review_note" TEXT;

CREATE INDEX "student_availability_blocks_intent_status_idx"
  ON "student_availability_blocks"("intent", "status");

CREATE INDEX "student_availability_blocks_reviewed_by_id_idx"
  ON "student_availability_blocks"("reviewed_by_id");

ALTER TABLE "student_availability_blocks"
  ADD CONSTRAINT "student_availability_blocks_reviewed_by_id_fkey"
  FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
