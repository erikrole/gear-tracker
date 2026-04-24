-- Soften LicenseCodeClaim.user FK from RESTRICT to SET NULL so deleting a
-- user with prior claim history does not 500. occupantLabel/"Unknown" already
-- handles the render case for a null user.

ALTER TABLE "license_code_claims"
  DROP CONSTRAINT IF EXISTS "license_code_claims_user_id_fkey";

ALTER TABLE "license_code_claims"
  ADD CONSTRAINT "license_code_claims_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
