CREATE TABLE "user_app_installations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "installation_hash" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "app_version" TEXT,
    "app_build" TEXT,
    "os_version" TEXT,
    "device_model" TEXT,
    "release_channel" TEXT,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_opened_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_app_installations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_app_installations_user_id_installation_hash_platform_key"
ON "user_app_installations"("user_id", "installation_hash", "platform");

CREATE INDEX "user_app_installations_user_id_last_seen_at_idx"
ON "user_app_installations"("user_id", "last_seen_at");

CREATE INDEX "user_app_installations_platform_last_seen_at_idx"
ON "user_app_installations"("platform", "last_seen_at");

ALTER TABLE "user_app_installations"
ADD CONSTRAINT "user_app_installations_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
