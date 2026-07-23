-- CreateTable
CREATE TABLE "booking_due_date_changes" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "previous_ends_at" TIMESTAMP(3) NOT NULL,
    "next_ends_at" TIMESTAMP(3) NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_due_date_changes_pkey" PRIMARY KEY ("id")
);

-- Backfill the bounded extension evidence still present in the 90-day audit log.
INSERT INTO "booking_due_date_changes" (
    "id",
    "booking_id",
    "actor_user_id",
    "previous_ends_at",
    "next_ends_at",
    "changed_at"
)
SELECT
    "audit_logs"."id",
    "audit_logs"."entity_id",
    "audit_logs"."actor_user_id",
    ("audit_logs"."before_json"->>'endsAt')::timestamptz AT TIME ZONE 'UTC',
    ("audit_logs"."after_json"->>'endsAt')::timestamptz AT TIME ZONE 'UTC',
    "audit_logs"."created_at"
FROM "audit_logs"
INNER JOIN "bookings" ON "bookings"."id" = "audit_logs"."entity_id"
WHERE "audit_logs"."entity_type" = 'booking'
  AND "audit_logs"."action" = 'extended'
  AND "audit_logs"."before_json"->>'endsAt' ~ '^\d{4}-\d{2}-\d{2}T'
  AND "audit_logs"."after_json"->>'endsAt' ~ '^\d{4}-\d{2}-\d{2}T'
  AND ("audit_logs"."after_json"->>'endsAt')::timestamptz
      > ("audit_logs"."before_json"->>'endsAt')::timestamptz
ON CONFLICT ("id") DO NOTHING;

-- CreateIndex
CREATE INDEX "booking_due_date_changes_booking_id_changed_at_idx" ON "booking_due_date_changes"("booking_id", "changed_at");

-- CreateIndex
CREATE INDEX "booking_due_date_changes_changed_at_idx" ON "booking_due_date_changes"("changed_at");

-- CreateIndex
CREATE INDEX "booking_due_date_changes_actor_user_id_idx" ON "booking_due_date_changes"("actor_user_id");

-- AddForeignKey
ALTER TABLE "booking_due_date_changes" ADD CONSTRAINT "booking_due_date_changes_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_due_date_changes" ADD CONSTRAINT "booking_due_date_changes_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
