-- Add default_traveler flag to sport assignments
ALTER TABLE "student_sport_assignments" ADD COLUMN "default_traveler" BOOLEAN NOT NULL DEFAULT false;

-- Create event travel roster table
CREATE TABLE "event_travel_members" (
  "id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "event_travel_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "event_travel_members_event_id_user_id_key" ON "event_travel_members"("event_id", "user_id");
CREATE INDEX "event_travel_members_event_id_idx" ON "event_travel_members"("event_id");

ALTER TABLE "event_travel_members" ADD CONSTRAINT "event_travel_members_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "event_travel_members" ADD CONSTRAINT "event_travel_members_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
