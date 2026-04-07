-- CreateTable
CREATE TABLE "kiosk_devices" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "activation_code" TEXT NOT NULL,
    "activated_at" TIMESTAMP(3),
    "session_token" TEXT,
    "last_seen_at" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kiosk_devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kiosk_devices_activation_code_key" ON "kiosk_devices"("activation_code");

-- CreateIndex
CREATE UNIQUE INDEX "kiosk_devices_session_token_key" ON "kiosk_devices"("session_token");

-- CreateIndex
CREATE INDEX "kiosk_devices_location_id_idx" ON "kiosk_devices"("location_id");

-- AddForeignKey
ALTER TABLE "kiosk_devices" ADD CONSTRAINT "kiosk_devices_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
