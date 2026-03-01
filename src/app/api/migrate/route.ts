export const runtime = "edge";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, HttpError, ok } from "@/lib/http";

const MIGRATION_SQL = `
-- Phase 1 schema additions (idempotent)

-- Enums (skip if they already exist)
DO $$ BEGIN CREATE TYPE "CalendarEventStatus" AS ENUM ('CONFIRMED', 'TENTATIVE', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Department table
CREATE TABLE IF NOT EXISTS "departments" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "departments_name_key" ON "departments"("name");

-- Asset extensions (idempotent column adds)
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "name" TEXT;
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "uw_asset_tag" TEXT;
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "consumable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "primary_scan_code" TEXT;
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "image_url" TEXT;
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "warranty_date" TIMESTAMP(3);
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "residual_value" DECIMAL(10,2);
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "department_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "assets_primary_scan_code_key" ON "assets"("primary_scan_code");
CREATE INDEX IF NOT EXISTS "assets_department_id_idx" ON "assets"("department_id");
CREATE INDEX IF NOT EXISTS "assets_primary_scan_code_idx" ON "assets"("primary_scan_code");

DO $$ BEGIN
  ALTER TABLE "assets" ADD CONSTRAINT "assets_department_id_fkey"
    FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Kit tables
CREATE TABLE IF NOT EXISTS "kits" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "location_id" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "kits_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "kits_name_location_id_key" ON "kits"("name", "location_id");
DO $$ BEGIN
  ALTER TABLE "kits" ADD CONSTRAINT "kits_location_id_fkey"
    FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "kit_memberships" (
  "id" TEXT NOT NULL,
  "kit_id" TEXT NOT NULL,
  "asset_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "kit_memberships_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "kit_memberships_kit_id_asset_id_key" ON "kit_memberships"("kit_id", "asset_id");
DO $$ BEGIN
  ALTER TABLE "kit_memberships" ADD CONSTRAINT "kit_memberships_kit_id_fkey"
    FOREIGN KEY ("kit_id") REFERENCES "kits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "kit_memberships" ADD CONSTRAINT "kit_memberships_asset_id_fkey"
    FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Calendar Sync tables
CREATE TABLE IF NOT EXISTS "calendar_sources" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "last_fetched_at" TIMESTAMP(3),
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "calendar_sources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "calendar_events" (
  "id" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "external_id" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "description" TEXT,
  "raw_summary" TEXT,
  "raw_location_text" TEXT,
  "raw_description" TEXT,
  "starts_at" TIMESTAMP(3) NOT NULL,
  "ends_at" TIMESTAMP(3) NOT NULL,
  "all_day" BOOLEAN NOT NULL DEFAULT false,
  "status" "CalendarEventStatus" NOT NULL DEFAULT 'CONFIRMED',
  "location_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "calendar_events_source_id_external_id_key" ON "calendar_events"("source_id", "external_id");
CREATE INDEX IF NOT EXISTS "calendar_events_starts_at_ends_at_idx" ON "calendar_events"("starts_at", "ends_at");
CREATE INDEX IF NOT EXISTS "calendar_events_location_id_idx" ON "calendar_events"("location_id");

DO $$ BEGIN
  ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_source_id_fkey"
    FOREIGN KEY ("source_id") REFERENCES "calendar_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_location_id_fkey"
    FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "location_mappings" (
  "id" TEXT NOT NULL,
  "pattern" TEXT NOT NULL,
  "location_id" TEXT NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "location_mappings_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "location_mappings" ADD CONSTRAINT "location_mappings_location_id_fkey"
    FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Notifications table
CREATE TABLE IF NOT EXISTS "notifications" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "payload" JSONB,
  "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
  "sent_at" TIMESTAMP(3),
  "read_at" TIMESTAMP(3),
  "dedupe_key" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_dedupe_key_key" ON "notifications"("dedupe_key");
CREATE INDEX IF NOT EXISTS "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");
CREATE INDEX IF NOT EXISTS "notifications_type_created_at_idx" ON "notifications"("type", "created_at");
`;

/**
 * POST /api/migrate
 * Runs the Phase 1 migration (idempotent). Admin only.
 */
export async function POST() {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN") {
      throw new HttpError(403, "Only admins can run migrations");
    }

    await db.$executeRawUnsafe(MIGRATION_SQL);

    return ok({ message: "Migration completed successfully" });
  } catch (error) {
    return fail(error);
  }
}
