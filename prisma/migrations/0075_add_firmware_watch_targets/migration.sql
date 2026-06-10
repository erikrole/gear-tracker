-- CreateEnum
CREATE TYPE "FirmwareSourceType" AS ENUM ('SONY_SUPPORT', 'CANON_SUPPORT');

-- CreateTable
CREATE TABLE "firmware_watch_targets" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "product_name" TEXT,
    "source_url" TEXT NOT NULL,
    "source_type" "FirmwareSourceType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "latest_version" TEXT,
    "latest_release_date" TIMESTAMP(3),
    "last_checked_at" TIMESTAMP(3),
    "last_changed_at" TIMESTAMP(3),
    "baseline_established_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "firmware_watch_targets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "firmware_watch_targets_source_url_key" ON "firmware_watch_targets"("source_url");

-- CreateIndex
CREATE INDEX "firmware_watch_targets_enabled_source_type_idx" ON "firmware_watch_targets"("enabled", "source_type");

-- CreateIndex
CREATE INDEX "firmware_watch_targets_brand_model_idx" ON "firmware_watch_targets"("brand", "model");
