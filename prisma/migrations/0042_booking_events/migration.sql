-- CreateTable
CREATE TABLE "booking_events" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "booking_events_booking_id_event_id_key" ON "booking_events"("booking_id", "event_id");

-- CreateIndex
CREATE INDEX "booking_events_event_id_idx" ON "booking_events"("event_id");

-- CreateIndex
CREATE INDEX "booking_events_booking_id_ordinal_idx" ON "booking_events"("booking_id", "ordinal");

-- AddForeignKey
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_booking_id_fkey"
  FOREIGN KEY ("booking_id") REFERENCES "bookings"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "calendar_events"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: for every existing booking with event_id, create a BookingEvent row with ordinal 0
INSERT INTO "booking_events" ("id", "booking_id", "event_id", "ordinal", "created_at")
SELECT
  'be_' || substr(md5(random()::text || b.id), 1, 24),
  b.id,
  b.event_id,
  0,
  NOW()
FROM "bookings" b
WHERE b.event_id IS NOT NULL;
