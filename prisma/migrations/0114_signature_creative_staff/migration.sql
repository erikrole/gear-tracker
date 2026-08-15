-- Creative staff are internal full-time Video/Photo/Graphics users attached
-- to their own season collection, so they do not have an external snapshot.

ALTER TYPE "SignatureMemberGroup" ADD VALUE 'CREATIVE_STAFF' BEFORE 'SUPPORT_STAFF';

ALTER TABLE "signature_members"
  ALTER COLUMN "source_snapshot_id" DROP NOT NULL;
