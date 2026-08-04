CREATE TYPE "ShiftAssignmentSource" AS ENUM ('MANUAL', 'RESERVATION', 'AUTO_FILL');

ALTER TABLE "shift_assignments"
ADD COLUMN "source" "ShiftAssignmentSource" NOT NULL DEFAULT 'MANUAL';

UPDATE "shift_assignments"
SET "source" = 'RESERVATION'
WHERE "notes" = 'Auto-assigned from an event gear reservation';
