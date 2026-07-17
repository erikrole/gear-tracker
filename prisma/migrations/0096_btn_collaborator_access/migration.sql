ALTER TABLE "users"
  ADD COLUMN "affiliation" "Affiliation",
  ADD COLUMN "collaborator_profile" "CollaboratorProfile";

ALTER TABLE "allowed_emails"
  ADD COLUMN "affiliation" "Affiliation",
  ADD COLUMN "collaborator_profile" "CollaboratorProfile";

ALTER TABLE "users"
  ADD CONSTRAINT "users_collaborator_profile_check" CHECK (
    ("role" = 'COLLABORATOR' AND "affiliation" = 'BIG_TEN_NETWORK' AND "collaborator_profile" = 'BTN_STANDARD')
    OR
    ("role" <> 'COLLABORATOR' AND "affiliation" IS NULL AND "collaborator_profile" IS NULL)
  );

ALTER TABLE "allowed_emails"
  ADD CONSTRAINT "allowed_emails_collaborator_profile_check" CHECK (
    ("role" = 'COLLABORATOR' AND "affiliation" = 'BIG_TEN_NETWORK' AND "collaborator_profile" = 'BTN_STANDARD')
    OR
    ("role" <> 'COLLABORATOR' AND "affiliation" IS NULL AND "collaborator_profile" IS NULL)
  );

CREATE INDEX "users_role_affiliation_idx" ON "users"("role", "affiliation");
CREATE INDEX "allowed_emails_role_affiliation_idx" ON "allowed_emails"("role", "affiliation");

CREATE TABLE "schedule_event_follows" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "source" "ScheduleFollowSource" NOT NULL DEFAULT 'MANUAL',
  "muted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "schedule_event_follows_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "schedule_event_follows_user_id_event_id_key"
ON "schedule_event_follows"("user_id", "event_id");

CREATE INDEX "schedule_event_follows_event_id_muted_at_idx"
ON "schedule_event_follows"("event_id", "muted_at");

ALTER TABLE "schedule_event_follows"
ADD CONSTRAINT "schedule_event_follows_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "schedule_event_follows"
ADD CONSTRAINT "schedule_event_follows_event_id_fkey"
FOREIGN KEY ("event_id") REFERENCES "calendar_events"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
