-- Blast notifications: staff broadcasts to event crews, named people, and dynamic groups.
--
-- Two tables, deliberately separate from `notifications`: a blast is one authored
-- message with a frozen target spec and an expiry, and each recipient carries an
-- independent delivery/read/acknowledgment ledger that the compose UI reports on.
-- A parallel `notifications` row is still written per recipient so the existing web
-- inbox and unread badge pick blasts up without new wiring.
--
-- `blast_recipients.notification_id` is intentionally NOT a foreign key: deleting an
-- inbox row must not erase the acknowledgment ledger.

CREATE TYPE "BlastSeverity" AS ENUM (
  'INFO',
  'WARNING',
  'URGENT'
);

CREATE TYPE "BlastStatus" AS ENUM (
  'SENDING',
  'SENT',
  'CANCELLED'
);

CREATE TYPE "BlastTargetKind" AS ENUM (
  'EVENT_CREW',
  'USERS',
  'DYNAMIC'
);

CREATE TYPE "BlastPushStatus" AS ENUM (
  'PENDING',
  'SENT',
  'SKIPPED_PREFS',
  'NO_DEVICE',
  'FAILED'
);

CREATE TABLE "blasts" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "severity" "BlastSeverity" NOT NULL DEFAULT 'INFO',
  "status" "BlastStatus" NOT NULL DEFAULT 'SENDING',
  "target_kind" "BlastTargetKind" NOT NULL,
  "target_spec" JSONB NOT NULL,
  "target_summary" TEXT NOT NULL,
  "event_id" TEXT,
  "requires_ack" BOOLEAN NOT NULL DEFAULT true,
  "expires_at" TIMESTAMP(3),
  "recipient_count" INTEGER NOT NULL DEFAULT 0,
  "created_by_id" TEXT NOT NULL,
  "sent_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "cancelled_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "blasts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "blast_recipients" (
  "id" TEXT NOT NULL,
  "blast_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "notification_id" TEXT,
  "push_status" "BlastPushStatus" NOT NULL DEFAULT 'PENDING',
  "push_attempted_at" TIMESTAMP(3),
  "delivered_at" TIMESTAMP(3),
  "read_at" TIMESTAMP(3),
  "acknowledged_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "blast_recipients_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "blasts_status_sent_at_idx" ON "blasts"("status", "sent_at");
CREATE INDEX "blasts_created_by_id_created_at_idx" ON "blasts"("created_by_id", "created_at");
CREATE INDEX "blasts_event_id_idx" ON "blasts"("event_id");
CREATE INDEX "blasts_cancelled_by_id_idx" ON "blasts"("cancelled_by_id");

CREATE UNIQUE INDEX "blast_recipients_blast_id_user_id_key"
  ON "blast_recipients"("blast_id", "user_id");
CREATE INDEX "blast_recipients_user_id_acknowledged_at_idx"
  ON "blast_recipients"("user_id", "acknowledged_at");
CREATE INDEX "blast_recipients_blast_id_acknowledged_at_idx"
  ON "blast_recipients"("blast_id", "acknowledged_at");

ALTER TABLE "blasts"
  ADD CONSTRAINT "blasts_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "blasts"
  ADD CONSTRAINT "blasts_cancelled_by_id_fkey"
  FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "blasts"
  ADD CONSTRAINT "blasts_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "calendar_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "blast_recipients"
  ADD CONSTRAINT "blast_recipients_blast_id_fkey"
  FOREIGN KEY ("blast_id") REFERENCES "blasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blast_recipients"
  ADD CONSTRAINT "blast_recipients_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
