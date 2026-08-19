CREATE TYPE "SoftwareCredentialAudience" AS ENUM ('STAFF', 'STUDENT', 'COLLABORATOR');

ALTER TABLE "software_credentials"
  ADD COLUMN "visible_to" "SoftwareCredentialAudience"[] NOT NULL
  DEFAULT ARRAY['STAFF', 'STUDENT']::"SoftwareCredentialAudience"[];
