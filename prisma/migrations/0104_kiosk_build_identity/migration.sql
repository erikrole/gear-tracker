-- Kiosk build identity.
--
-- The heartbeat previously carried nothing but the device id, so the server
-- could not tell which app build a given kiosk was running. That made every
-- rollout a guessing game ("did the new build actually land on Video Office?")
-- and gave field bug reports no version to correlate against.
--
-- All columns are nullable: a kiosk running an older build simply never
-- reports them, and the admin UI shows "Unknown" rather than failing.
ALTER TABLE "kiosk_devices"
  ADD COLUMN "app_version" TEXT,
  ADD COLUMN "app_build" TEXT,
  ADD COLUMN "os_version" TEXT,
  ADD COLUMN "device_model" TEXT,
  ADD COLUMN "app_reported_at" TIMESTAMP(3);
