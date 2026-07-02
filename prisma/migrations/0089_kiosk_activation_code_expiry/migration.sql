-- Kiosk activation codes become single-use and time-limited.
-- activation_code is now nullable so it can be cleared once redeemed, and
-- activation_code_expires_at bounds how long an unredeemed code stays valid.

ALTER TABLE "kiosk_devices" ALTER COLUMN "activation_code" DROP NOT NULL;

ALTER TABLE "kiosk_devices" ADD COLUMN "activation_code_expires_at" TIMESTAMP(3);
