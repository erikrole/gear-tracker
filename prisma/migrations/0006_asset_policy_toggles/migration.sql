-- AlterTable: add policy toggle booleans and link URL to assets
ALTER TABLE "assets" ADD COLUMN "available_for_reservation" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "assets" ADD COLUMN "available_for_checkout" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "assets" ADD COLUMN "available_for_custody" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "assets" ADD COLUMN "link_url" TEXT;
