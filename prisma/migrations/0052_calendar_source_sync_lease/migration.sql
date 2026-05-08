-- Add a short-lived lease for manual calendar-source syncs.
-- This prevents concurrent requests from running the same external fetch and
-- shift generation pipeline at the same time.
ALTER TABLE "calendar_sources"
ADD COLUMN "sync_lease_until" TIMESTAMP(3),
ADD COLUMN "sync_lease_owner" TEXT;

CREATE INDEX "calendar_sources_sync_lease_until_idx"
ON "calendar_sources"("sync_lease_until");
