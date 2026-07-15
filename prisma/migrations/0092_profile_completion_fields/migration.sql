CREATE TYPE "ApparelFit" AS ENUM ('UNISEX', 'WOMENS', 'MENS');
CREATE TYPE "ShoeSizeSystem" AS ENUM ('US_WOMENS', 'US_MENS');

ALTER TABLE "users"
  ADD COLUMN "personal_phone" TEXT,
  ADD COLUMN "work_phone" TEXT,
  ADD COLUMN "work_phone_not_applicable" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "wiscard_card_number" TEXT,
  ADD COLUMN "wiscard_issue_code" TEXT,
  ADD COLUMN "profile_prompt_snoozed_until" TIMESTAMP(3),
  ADD COLUMN "top_size_fit" "ApparelFit",
  ADD COLUMN "shoe_size_system" "ShoeSizeSystem";

CREATE UNIQUE INDEX "users_wiscard_card_number_key" ON "users"("wiscard_card_number");
