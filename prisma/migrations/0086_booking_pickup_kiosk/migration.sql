-- Booking: record which kiosk device handled pickup (return-routing groundwork)

ALTER TABLE "bookings" ADD COLUMN "pickup_kiosk_device_id" TEXT;

CREATE INDEX "bookings_pickup_kiosk_device_id_idx" ON "bookings"("pickup_kiosk_device_id");

ALTER TABLE "bookings" ADD CONSTRAINT "bookings_pickup_kiosk_device_id_fkey"
  FOREIGN KEY ("pickup_kiosk_device_id") REFERENCES "kiosk_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
