ALTER TYPE "ShiftArea" ADD VALUE IF NOT EXISTS 'LIVE_PRODUCTION';

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "birthday_month" INTEGER,
  ADD COLUMN IF NOT EXISTS "birthday_day" INTEGER,
  ADD COLUMN IF NOT EXISTS "birth_year" INTEGER;

ALTER TABLE "users"
  ADD CONSTRAINT "users_birthday_month_check" CHECK ("birthday_month" IS NULL OR "birthday_month" BETWEEN 1 AND 12),
  ADD CONSTRAINT "users_birthday_day_check" CHECK ("birthday_day" IS NULL OR "birthday_day" BETWEEN 1 AND 31),
  ADD CONSTRAINT "users_birth_year_check" CHECK ("birth_year" IS NULL OR "birth_year" BETWEEN 1900 AND 2100),
  ADD CONSTRAINT "users_birthday_month_day_pair_check" CHECK (("birthday_month" IS NULL) = ("birthday_day" IS NULL));
