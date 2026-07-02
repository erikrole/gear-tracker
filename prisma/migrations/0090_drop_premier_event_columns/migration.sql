-- Premier events concept removed (2026-07-02): all open-shift claims are
-- instant and trades no longer require approval. The code and schema dropped
-- these in the same-day cleanup; this migration drops the live columns so the
-- database matches prisma/schema.prisma. Live data at removal time: one
-- shift_group flagged premier, zero active approval-requiring trades.
ALTER TABLE "shift_groups" DROP COLUMN IF EXISTS "is_premier";
ALTER TABLE "shift_trades" DROP COLUMN IF EXISTS "requires_approval";
