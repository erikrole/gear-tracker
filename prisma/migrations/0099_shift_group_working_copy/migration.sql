-- Version the worker-visible schedule so publish retries and notifications can
-- use a stable event revision instead of timestamps alone.
ALTER TABLE "shift_groups"
ADD COLUMN "published_version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "shifts"
ADD COLUMN "template_managed" BOOLEAN NOT NULL DEFAULT false;

-- Existing generated slots become eligible for conservative default rebases.
-- The creation-time window excludes slots added manually after generation.
UPDATE "shifts" AS shift
SET "template_managed" = true
FROM "shift_groups" AS shift_group
WHERE shift."shift_group_id" = shift_group."id"
  AND shift_group."generated_at" IS NOT NULL
  AND ABS(EXTRACT(EPOCH FROM (shift."created_at" - shift_group."generated_at"))) <= 300
  AND shift."notes" IS NULL
  AND shift."call_starts_at" IS NULL
  AND shift."call_ends_at" IS NULL
  AND shift."updated_at" = shift."created_at";

UPDATE "shift_groups"
SET "published_version" = 1
WHERE "published_at" IS NOT NULL;

-- Staff edits are isolated here until an explicit publish reconciles them into
-- the relational shifts and assignments consumed by existing clients.
CREATE TABLE "shift_group_working_copies" (
    "shift_group_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "base_published_version" INTEGER NOT NULL,
    "payload_version" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "updated_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_group_working_copies_pkey" PRIMARY KEY ("shift_group_id"),
    CONSTRAINT "shift_group_working_copies_version_check" CHECK ("version" > 0),
    CONSTRAINT "shift_group_working_copies_base_version_check" CHECK ("base_published_version" >= 0),
    CONSTRAINT "shift_group_working_copies_payload_version_check" CHECK ("payload_version" > 0)
);

CREATE INDEX "shift_group_working_copies_updated_by_id_updated_at_idx"
ON "shift_group_working_copies"("updated_by_id", "updated_at");

ALTER TABLE "shift_group_working_copies"
ADD CONSTRAINT "shift_group_working_copies_shift_group_id_fkey"
FOREIGN KEY ("shift_group_id") REFERENCES "shift_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shift_group_working_copies"
ADD CONSTRAINT "shift_group_working_copies_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "shift_group_working_copies"
ADD CONSTRAINT "shift_group_working_copies_updated_by_id_fkey"
FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
