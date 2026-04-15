-- Add archived_at to shift_groups
ALTER TABLE "shift_groups" ADD COLUMN "archived_at" TIMESTAMP(3);

-- Add attended to shift_assignments (null=unlogged, true=attended, false=no-show)
ALTER TABLE "shift_assignments" ADD COLUMN "attended" BOOLEAN;
