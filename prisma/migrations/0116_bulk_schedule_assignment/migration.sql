CREATE TYPE "ScheduleBulkAssignmentStatus" AS ENUM ('PENDING', 'RELEASED', 'PARTIAL', 'BLOCKED');

CREATE TYPE "ScheduleBulkAssignmentItemStatus" AS ENUM ('PENDING', 'RELEASED', 'BLOCKED', 'SUPERSEDED');

CREATE TABLE "schedule_bulk_assignments" (
  "id" TEXT NOT NULL,
  "created_by_id" TEXT NOT NULL,
  "sport_code" TEXT,
  "range_starts_at" TIMESTAMP(3) NOT NULL,
  "range_ends_at" TIMESTAMP(3) NOT NULL,
  "area" "ShiftArea",
  "preview_fingerprint" TEXT NOT NULL,
  "release_at" TIMESTAMP(3) NOT NULL,
  "status" "ScheduleBulkAssignmentStatus" NOT NULL DEFAULT 'PENDING',
  "notification_sent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "schedule_bulk_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "schedule_bulk_assignment_items" (
  "id" TEXT NOT NULL,
  "bulk_assignment_id" TEXT NOT NULL,
  "shift_group_id" TEXT NOT NULL,
  "expected_version" INTEGER NOT NULL,
  "proposal_payload" JSONB NOT NULL,
  "status" "ScheduleBulkAssignmentItemStatus" NOT NULL DEFAULT 'PENDING',
  "released_version" INTEGER,
  "error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "schedule_bulk_assignment_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "schedule_bulk_assignments_created_by_id_created_at_idx" ON "schedule_bulk_assignments"("created_by_id", "created_at");
CREATE INDEX "schedule_bulk_assignments_status_release_at_idx" ON "schedule_bulk_assignments"("status", "release_at");
CREATE UNIQUE INDEX "schedule_bulk_assignment_items_bulk_assignment_id_shift_group_id_key" ON "schedule_bulk_assignment_items"("bulk_assignment_id", "shift_group_id");
CREATE INDEX "schedule_bulk_assignment_items_shift_group_id_status_idx" ON "schedule_bulk_assignment_items"("shift_group_id", "status");

ALTER TABLE "schedule_bulk_assignment_items"
  ADD CONSTRAINT "schedule_bulk_assignment_items_bulk_assignment_id_fkey"
  FOREIGN KEY ("bulk_assignment_id") REFERENCES "schedule_bulk_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "schedule_bulk_assignment_items"
  ADD CONSTRAINT "schedule_bulk_assignment_items_shift_group_id_fkey"
  FOREIGN KEY ("shift_group_id") REFERENCES "shift_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
