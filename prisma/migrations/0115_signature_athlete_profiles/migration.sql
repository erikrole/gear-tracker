-- Website profile details belong to student-athlete signature members.
-- Existing staff and ad-hoc members remain nullable so the capture workflow
-- does not require athlete-only data for non-athlete signers.

ALTER TABLE "signature_members"
  ADD COLUMN IF NOT EXISTS "birthday" DATE,
  ADD COLUMN IF NOT EXISTS "hometown" TEXT,
  ADD COLUMN IF NOT EXISTS "instagram_handle" TEXT,
  ADD COLUMN IF NOT EXISTS "tiktok_handle" TEXT,
  ADD COLUMN IF NOT EXISTS "x_handle" TEXT;
