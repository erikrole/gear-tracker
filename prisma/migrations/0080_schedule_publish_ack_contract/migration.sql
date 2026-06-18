-- Add schedule publication metadata to shift groups.
ALTER TABLE "shift_groups"
ADD COLUMN "published_at" TIMESTAMP(3),
ADD COLUMN "published_by_id" TEXT,
ADD COLUMN "last_published_snapshot" JSONB;

-- Add worker acknowledgement metadata to shift assignments.
ALTER TABLE "shift_assignments"
ADD COLUMN "acknowledged_at" TIMESTAMP(3),
ADD COLUMN "acknowledged_by_id" TEXT;

CREATE INDEX "shift_groups_published_at_idx" ON "shift_groups"("published_at");
CREATE INDEX "shift_groups_published_by_id_idx" ON "shift_groups"("published_by_id");
CREATE INDEX "shift_assignments_acknowledged_by_id_idx" ON "shift_assignments"("acknowledged_by_id");
CREATE INDEX "shift_assignments_user_id_status_acknowledged_at_idx" ON "shift_assignments"("user_id", "status", "acknowledged_at");

ALTER TABLE "shift_groups"
ADD CONSTRAINT "shift_groups_published_by_id_fkey"
FOREIGN KEY ("published_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "shift_assignments"
ADD CONSTRAINT "shift_assignments_acknowledged_by_id_fkey"
FOREIGN KEY ("acknowledged_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
