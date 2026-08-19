-- Shared software account metadata stays queryable, while account emails and
-- passwords are stored as application-encrypted ciphertext.

CREATE TABLE "software_credentials" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "website_url" TEXT,
    "account_email_ciphertext" TEXT NOT NULL,
    "password_ciphertext" TEXT NOT NULL,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "software_credentials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "software_credentials_name_key" ON "software_credentials"("name");
CREATE INDEX "software_credentials_archived_at_idx" ON "software_credentials"("archived_at");
