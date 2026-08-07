-- Keep the existing versioned staging row as an implementation detail while
-- replacing manual publication with a durable ten-minute quiet-period release.
ALTER TABLE "shift_group_working_copies"
ADD COLUMN "auto_release_at" TIMESTAMP(3),
ADD COLUMN "auto_release_run_id" TEXT,
ADD COLUMN "auto_release_error" TEXT;

CREATE INDEX "shift_group_working_copies_auto_release_at_idx"
ON "shift_group_working_copies"("auto_release_at");
