-- AlterTable
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "location_locked" BOOLEAN NOT NULL DEFAULT false;
