-- Manual calendar events are created directly in Gear Tracker and do not belong
-- to an external calendar source. The Prisma schema already models source_id as
-- nullable; this reconciles the database constraint with that contract.
ALTER TABLE "calendar_events" ALTER COLUMN "source_id" DROP NOT NULL;
