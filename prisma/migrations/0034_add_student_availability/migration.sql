-- Add student_availability_blocks table for semester class schedule tracking.
-- Stores recurring weekly blocks (day + time-of-day) per user.
-- Used to flag assignment conflicts during auto-assign (Phase 2).

CREATE TABLE "student_availability_blocks" (
    "id"             TEXT NOT NULL,
    "user_id"        TEXT NOT NULL,
    "day_of_week"    INTEGER NOT NULL,
    "starts_at"      TEXT NOT NULL,
    "ends_at"        TEXT NOT NULL,
    "label"          TEXT,
    "semester_label" TEXT,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_availability_blocks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "student_availability_blocks_user_id_idx" ON "student_availability_blocks"("user_id");

ALTER TABLE "student_availability_blocks"
    ADD CONSTRAINT "student_availability_blocks_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
