-- AlterTable
ALTER TABLE "sport_configs" ADD COLUMN "call_time_before" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "sport_configs" ADD COLUMN "call_time_after" INTEGER NOT NULL DEFAULT 60;
