-- Add conflict tracking columns to shift_assignments
ALTER TABLE "shift_assignments" ADD COLUMN "has_conflict" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "shift_assignments" ADD COLUMN "conflict_note" TEXT;
