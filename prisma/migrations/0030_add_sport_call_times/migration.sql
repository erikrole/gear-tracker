-- AlterTable
ALTER TABLE "sport_configs" ADD COLUMN "shift_start_offset" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "sport_configs" ADD COLUMN "shift_end_offset" INTEGER NOT NULL DEFAULT 60;
