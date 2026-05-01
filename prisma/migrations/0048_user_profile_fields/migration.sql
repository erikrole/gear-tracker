-- Move this file to: prisma/migrations/0048_user_profile_fields/migration.sql
-- (Claude is blocked from writing under prisma/migrations/ by .claude/settings.json)
-- Or run:  npx prisma migrate dev --create-only --name add_user_profile_fields
-- and replace the generated SQL body with the contents below.

-- User profile fields migrated from the team Google Sheet.
-- Adds title, athletics email, start date, direct report (FK + free-text fallback),
-- grad year + optional override, and clothing/shoe sizes.

CREATE TYPE "StudentYear" AS ENUM ('FRESHMAN', 'SOPHOMORE', 'JUNIOR', 'SENIOR', 'GRAD');

ALTER TABLE "users"
  ADD COLUMN "title"                  TEXT,
  ADD COLUMN "athletics_email"        TEXT,
  ADD COLUMN "start_date"             DATE,
  ADD COLUMN "direct_report_id"       TEXT,
  ADD COLUMN "direct_report_name"     TEXT,
  ADD COLUMN "grad_year"              INTEGER,
  ADD COLUMN "student_year_override"  "StudentYear",
  ADD COLUMN "top_size"               TEXT,
  ADD COLUMN "bottom_size"            TEXT,
  ADD COLUMN "shoe_size"              TEXT;

CREATE UNIQUE INDEX "users_athletics_email_key" ON "users"("athletics_email");
CREATE INDEX "users_direct_report_id_idx" ON "users"("direct_report_id");

ALTER TABLE "users"
  ADD CONSTRAINT "users_direct_report_id_fkey"
  FOREIGN KEY ("direct_report_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
