-- Add persistent event edit locks and non-destructive event archive marker.
ALTER TABLE "calendar_events"
  ADD COLUMN IF NOT EXISTS "summary_locked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "is_home_locked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "calendar_events_archived_at_idx" ON "calendar_events"("archived_at");
