-- Add Wiscard identity for kiosk user selection.
ALTER TABLE "users" ADD COLUMN "wiscard_number" TEXT;

CREATE UNIQUE INDEX "users_wiscard_number_key" ON "users"("wiscard_number");

-- Record location reconciliation evidence for kiosk custody scans.
ALTER TABLE "scan_events"
  ADD COLUMN "location_mismatch" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "expected_location_id" TEXT,
  ADD COLUMN "actual_location_id" TEXT;

CREATE INDEX "scan_events_location_mismatch_idx" ON "scan_events"("location_mismatch");
