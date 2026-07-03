CREATE TABLE "live_activity_start_tokens" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "activity" TEXT NOT NULL,
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMP(3),
  CONSTRAINT "live_activity_start_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "live_activity_starts" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "activity" TEXT NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ended_at" TIMESTAMP(3),
  CONSTRAINT "live_activity_starts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "live_activity_start_tokens_token_key" ON "live_activity_start_tokens"("token");
CREATE INDEX "live_activity_start_tokens_user_id_activity_revoked_at_idx" ON "live_activity_start_tokens"("user_id", "activity", "revoked_at");

CREATE UNIQUE INDEX "live_activity_starts_user_id_booking_id_activity_key" ON "live_activity_starts"("user_id", "booking_id", "activity");
CREATE INDEX "live_activity_starts_booking_id_activity_ended_at_idx" ON "live_activity_starts"("booking_id", "activity", "ended_at");
CREATE INDEX "live_activity_starts_user_id_activity_ended_at_idx" ON "live_activity_starts"("user_id", "activity", "ended_at");

ALTER TABLE "live_activity_start_tokens"
  ADD CONSTRAINT "live_activity_start_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "live_activity_starts"
  ADD CONSTRAINT "live_activity_starts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "live_activity_starts"
  ADD CONSTRAINT "live_activity_starts_booking_id_fkey"
  FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
