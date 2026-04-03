-- CreateEnum
CREATE TYPE "CheckinReportType" AS ENUM ('DAMAGED', 'LOST');

-- CreateTable
CREATE TABLE "checkin_item_reports" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "type" "CheckinReportType" NOT NULL,
    "description" TEXT,
    "reported_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkin_item_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "checkin_item_reports_booking_id_idx" ON "checkin_item_reports"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "checkin_item_reports_booking_id_asset_id_key" ON "checkin_item_reports"("booking_id", "asset_id");

-- AddForeignKey
ALTER TABLE "checkin_item_reports" ADD CONSTRAINT "checkin_item_reports_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_item_reports" ADD CONSTRAINT "checkin_item_reports_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_item_reports" ADD CONSTRAINT "checkin_item_reports_reported_by_id_fkey" FOREIGN KEY ("reported_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
