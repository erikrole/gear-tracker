-- Add event linkage fields to bookings
ALTER TABLE "bookings" ADD COLUMN "event_id" TEXT;
ALTER TABLE "bookings" ADD COLUMN "sport_code" TEXT;

-- Add sport parsing fields to calendar_events
ALTER TABLE "calendar_events" ADD COLUMN "sport_code" TEXT;
ALTER TABLE "calendar_events" ADD COLUMN "is_home" BOOLEAN;
ALTER TABLE "calendar_events" ADD COLUMN "opponent" TEXT;

-- Foreign key: bookings.event_id -> calendar_events.id
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "calendar_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "bookings_event_id_idx" ON "bookings"("event_id");
CREATE INDEX "bookings_sport_code_idx" ON "bookings"("sport_code");
CREATE INDEX "calendar_events_sport_code_idx" ON "calendar_events"("sport_code");
