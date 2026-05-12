-- AlterTable
ALTER TABLE "kiosk_devices" ADD COLUMN "session_expires_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "kiosk_devices_session_expires_at_idx" ON "kiosk_devices"("session_expires_at");
