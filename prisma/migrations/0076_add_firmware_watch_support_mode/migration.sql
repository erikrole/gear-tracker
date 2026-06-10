-- CreateEnum
CREATE TYPE "FirmwareSupportMode" AS ENUM ('ACTIVE', 'MAINTENANCE', 'UNKNOWN');

-- AlterTable
ALTER TABLE "firmware_watch_targets"
ADD COLUMN "support_mode" "FirmwareSupportMode" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "support_note" TEXT;
