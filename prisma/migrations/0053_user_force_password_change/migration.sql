-- Track users who must replace an administrator-issued temporary password.
ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "force_password_change" BOOLEAN NOT NULL DEFAULT false;
