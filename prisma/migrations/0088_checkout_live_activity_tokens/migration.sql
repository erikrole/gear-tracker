CREATE TABLE "live_activity_tokens" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "activity" TEXT NOT NULL,
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ended_at" TIMESTAMP(3),

  CONSTRAINT "live_activity_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "live_activity_tokens_token_key" ON "live_activity_tokens"("token");
CREATE INDEX "live_activity_tokens_booking_id_ended_at_idx" ON "live_activity_tokens"("booking_id", "ended_at");
CREATE INDEX "live_activity_tokens_user_id_activity_ended_at_idx" ON "live_activity_tokens"("user_id", "activity", "ended_at");

ALTER TABLE "live_activity_tokens"
  ADD CONSTRAINT "live_activity_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "live_activity_tokens"
  ADD CONSTRAINT "live_activity_tokens_booking_id_fkey"
  FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
