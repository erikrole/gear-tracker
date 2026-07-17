CREATE TYPE "CollaboratorPolicyStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

CREATE TABLE "collaborator_affiliations" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "badge_label" TEXT NOT NULL,
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "collaborator_affiliations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "collaborator_affiliations_display_name_check" CHECK (char_length("display_name") BETWEEN 1 AND 80),
  CONSTRAINT "collaborator_affiliations_badge_label_check" CHECK (char_length("badge_label") BETWEEN 2 AND 12)
);

CREATE UNIQUE INDEX "collaborator_affiliations_key_key"
ON "collaborator_affiliations"("key");

CREATE INDEX "collaborator_affiliations_archived_at_idx"
ON "collaborator_affiliations"("archived_at");

CREATE TABLE "collaborator_policies" (
  "id" TEXT NOT NULL,
  "affiliation_id" TEXT NOT NULL,
  "status" "CollaboratorPolicyStatus" NOT NULL DEFAULT 'SUSPENDED',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "collaborator_policies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "collaborator_policies_version_check" CHECK ("version" >= 1),
  CONSTRAINT "collaborator_policies_affiliation_id_fkey"
    FOREIGN KEY ("affiliation_id") REFERENCES "collaborator_affiliations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "collaborator_policies_affiliation_id_key"
ON "collaborator_policies"("affiliation_id");

CREATE INDEX "collaborator_policies_status_idx"
ON "collaborator_policies"("status");

CREATE TABLE "collaborator_policy_grants" (
  "id" TEXT NOT NULL,
  "policy_id" TEXT NOT NULL,
  "capability_key" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "collaborator_policy_grants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "collaborator_policy_grants_policy_id_fkey"
    FOREIGN KEY ("policy_id") REFERENCES "collaborator_policies"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "collaborator_policy_grants_policy_id_capability_key_key"
ON "collaborator_policy_grants"("policy_id", "capability_key");

CREATE INDEX "collaborator_policy_grants_capability_key_policy_id_idx"
ON "collaborator_policy_grants"("capability_key", "policy_id");

CREATE TABLE "collaborator_policy_revisions" (
  "id" TEXT NOT NULL,
  "policy_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "CollaboratorPolicyStatus" NOT NULL,
  "capabilities" JSONB NOT NULL,
  "actor_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "collaborator_policy_revisions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "collaborator_policy_revisions_policy_id_fkey"
    FOREIGN KEY ("policy_id") REFERENCES "collaborator_policies"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "collaborator_policy_revisions_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "collaborator_policy_revisions_policy_id_version_key"
ON "collaborator_policy_revisions"("policy_id", "version");

CREATE INDEX "collaborator_policy_revisions_actor_user_id_created_at_idx"
ON "collaborator_policy_revisions"("actor_user_id", "created_at");

ALTER TABLE "users" ADD COLUMN "collaborator_policy_id" TEXT;
ALTER TABLE "allowed_emails" ADD COLUMN "collaborator_policy_id" TEXT;

ALTER TABLE "users"
ADD CONSTRAINT "users_collaborator_policy_id_fkey"
FOREIGN KEY ("collaborator_policy_id") REFERENCES "collaborator_policies"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "allowed_emails"
ADD CONSTRAINT "allowed_emails_collaborator_policy_id_fkey"
FOREIGN KEY ("collaborator_policy_id") REFERENCES "collaborator_policies"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "users_collaborator_policy_id_idx" ON "users"("collaborator_policy_id");
CREATE INDEX "allowed_emails_collaborator_policy_id_idx" ON "allowed_emails"("collaborator_policy_id");

INSERT INTO "collaborator_affiliations"
  ("id", "key", "display_name", "badge_label")
VALUES
  ('affiliation_btn', 'BIG_TEN_NETWORK', 'Big Ten Network', 'BTN'),
  ('affiliation_learfield', 'LEARFIELD', 'Learfield', 'LEARFIELD');

INSERT INTO "collaborator_policies"
  ("id", "affiliation_id", "status", "version")
VALUES
  ('policy_btn_standard', 'affiliation_btn', 'ACTIVE', 1),
  ('policy_learfield_standard', 'affiliation_learfield', 'SUSPENDED', 1);

INSERT INTO "collaborator_policy_grants"
  ("id", "policy_id", "capability_key")
VALUES
  ('grant_btn_gear_catalog_view', 'policy_btn_standard', 'GEAR_CATALOG_VIEW'),
  ('grant_btn_my_gear_view', 'policy_btn_standard', 'MY_GEAR_VIEW'),
  ('grant_btn_reservation_create', 'policy_btn_standard', 'RESERVATION_CREATE'),
  ('grant_btn_reservation_edit_own', 'policy_btn_standard', 'RESERVATION_EDIT_OWN'),
  ('grant_btn_reservation_cancel_own', 'policy_btn_standard', 'RESERVATION_CANCEL_OWN'),
  ('grant_btn_reservation_extend_own', 'policy_btn_standard', 'RESERVATION_EXTEND_OWN'),
  ('grant_btn_published_schedule_view', 'policy_btn_standard', 'PUBLISHED_SCHEDULE_VIEW'),
  ('grant_btn_schedule_follow', 'policy_btn_standard', 'SCHEDULE_FOLLOW'),
  ('grant_btn_kiosk_roster_eligible', 'policy_btn_standard', 'KIOSK_ROSTER_ELIGIBLE');

INSERT INTO "collaborator_policy_revisions"
  ("id", "policy_id", "version", "status", "capabilities")
VALUES
  (
    'revision_btn_1',
    'policy_btn_standard',
    1,
    'ACTIVE',
    '["GEAR_CATALOG_VIEW","MY_GEAR_VIEW","RESERVATION_CREATE","RESERVATION_EDIT_OWN","RESERVATION_CANCEL_OWN","RESERVATION_EXTEND_OWN","PUBLISHED_SCHEDULE_VIEW","SCHEDULE_FOLLOW","KIOSK_ROSTER_ELIGIBLE"]'::jsonb
  ),
  ('revision_learfield_1', 'policy_learfield_standard', 1, 'SUSPENDED', '[]'::jsonb);

UPDATE "users"
SET "collaborator_policy_id" = 'policy_btn_standard'
WHERE "role" = 'COLLABORATOR'
  AND "collaborator_profile" = 'BTN_STANDARD';

UPDATE "allowed_emails"
SET "collaborator_policy_id" = 'policy_btn_standard'
WHERE "role" = 'COLLABORATOR'
  AND "collaborator_profile" = 'BTN_STANDARD';

ALTER TABLE "users" DROP CONSTRAINT "users_collaborator_profile_check";
ALTER TABLE "allowed_emails" DROP CONSTRAINT "allowed_emails_collaborator_profile_check";

ALTER TABLE "users"
ADD CONSTRAINT "users_collaborator_policy_check" CHECK (
  ("role" = 'COLLABORATOR' AND "collaborator_policy_id" IS NOT NULL)
  OR
  (
    "role" <> 'COLLABORATOR'
    AND "collaborator_policy_id" IS NULL
    AND "affiliation" IS NULL
    AND "collaborator_profile" IS NULL
  )
);

ALTER TABLE "allowed_emails"
ADD CONSTRAINT "allowed_emails_collaborator_policy_check" CHECK (
  ("role" = 'COLLABORATOR' AND "collaborator_policy_id" IS NOT NULL)
  OR
  (
    "role" <> 'COLLABORATOR'
    AND "collaborator_policy_id" IS NULL
    AND "affiliation" IS NULL
    AND "collaborator_profile" IS NULL
  )
);
