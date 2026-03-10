export const runtime = "edge";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, HttpError, ok } from "@/lib/http";

/**
 * Each migration step is a single SQL statement.
 * DO $$ blocks don't work via Neon HTTP, so we use
 * a try/catch wrapper per-statement instead.
 */
const STEPS: { label: string; sql: string; ignoreError?: boolean }[] = [
  // ── Phase 1 (0003): Enums ──
  { label: "enum CalendarEventStatus", sql: `CREATE TYPE "CalendarEventStatus" AS ENUM ('CONFIRMED', 'TENTATIVE', 'CANCELLED')`, ignoreError: true },
  { label: "enum NotificationChannel", sql: `CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL')`, ignoreError: true },

  // ── Departments ──
  { label: "table departments", sql: `CREATE TABLE IF NOT EXISTS "departments" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "departments_pkey" PRIMARY KEY ("id"))` },
  { label: "index departments_name_key", sql: `CREATE UNIQUE INDEX IF NOT EXISTS "departments_name_key" ON "departments"("name")` },

  // ── Asset extensions ──
  { label: "col assets.name", sql: `ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "name" TEXT` },
  { label: "col assets.uw_asset_tag", sql: `ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "uw_asset_tag" TEXT` },
  { label: "col assets.consumable", sql: `ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "consumable" BOOLEAN NOT NULL DEFAULT false` },
  { label: "col assets.primary_scan_code", sql: `ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "primary_scan_code" TEXT` },
  { label: "col assets.image_url", sql: `ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "image_url" TEXT` },
  { label: "col assets.warranty_date", sql: `ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "warranty_date" TIMESTAMP(3)` },
  { label: "col assets.residual_value", sql: `ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "residual_value" DECIMAL(10,2)` },
  { label: "col assets.department_id", sql: `ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "department_id" TEXT` },
  { label: "index assets_primary_scan_code_key", sql: `CREATE UNIQUE INDEX IF NOT EXISTS "assets_primary_scan_code_key" ON "assets"("primary_scan_code")` },
  { label: "index assets_department_id_idx", sql: `CREATE INDEX IF NOT EXISTS "assets_department_id_idx" ON "assets"("department_id")` },
  { label: "index assets_primary_scan_code_idx", sql: `CREATE INDEX IF NOT EXISTS "assets_primary_scan_code_idx" ON "assets"("primary_scan_code")` },
  { label: "fk assets_department_id", sql: `ALTER TABLE "assets" ADD CONSTRAINT "assets_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE`, ignoreError: true },

  // ── Kits ──
  { label: "table kits", sql: `CREATE TABLE IF NOT EXISTS "kits" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT, "location_id" TEXT NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "kits_pkey" PRIMARY KEY ("id"))` },
  { label: "index kits_name_location_id_key", sql: `CREATE UNIQUE INDEX IF NOT EXISTS "kits_name_location_id_key" ON "kits"("name", "location_id")` },
  { label: "fk kits_location_id", sql: `ALTER TABLE "kits" ADD CONSTRAINT "kits_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE`, ignoreError: true },

  { label: "table kit_memberships", sql: `CREATE TABLE IF NOT EXISTS "kit_memberships" ("id" TEXT NOT NULL, "kit_id" TEXT NOT NULL, "asset_id" TEXT NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "kit_memberships_pkey" PRIMARY KEY ("id"))` },
  { label: "index kit_memberships_kit_id_asset_id_key", sql: `CREATE UNIQUE INDEX IF NOT EXISTS "kit_memberships_kit_id_asset_id_key" ON "kit_memberships"("kit_id", "asset_id")` },
  { label: "fk kit_memberships_kit_id", sql: `ALTER TABLE "kit_memberships" ADD CONSTRAINT "kit_memberships_kit_id_fkey" FOREIGN KEY ("kit_id") REFERENCES "kits"("id") ON DELETE CASCADE ON UPDATE CASCADE`, ignoreError: true },
  { label: "fk kit_memberships_asset_id", sql: `ALTER TABLE "kit_memberships" ADD CONSTRAINT "kit_memberships_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE`, ignoreError: true },

  // ── Calendar Sync ──
  { label: "table calendar_sources", sql: `CREATE TABLE IF NOT EXISTS "calendar_sources" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, "url" TEXT NOT NULL, "enabled" BOOLEAN NOT NULL DEFAULT true, "last_fetched_at" TIMESTAMP(3), "last_error" TEXT, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "calendar_sources_pkey" PRIMARY KEY ("id"))` },

  { label: "table calendar_events", sql: `CREATE TABLE IF NOT EXISTS "calendar_events" ("id" TEXT NOT NULL, "source_id" TEXT NOT NULL, "external_id" TEXT NOT NULL, "summary" TEXT NOT NULL, "description" TEXT, "raw_summary" TEXT, "raw_location_text" TEXT, "raw_description" TEXT, "starts_at" TIMESTAMP(3) NOT NULL, "ends_at" TIMESTAMP(3) NOT NULL, "all_day" BOOLEAN NOT NULL DEFAULT false, "status" "CalendarEventStatus" NOT NULL DEFAULT 'CONFIRMED', "location_id" TEXT, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id"))` },
  { label: "index calendar_events_source_external", sql: `CREATE UNIQUE INDEX IF NOT EXISTS "calendar_events_source_id_external_id_key" ON "calendar_events"("source_id", "external_id")` },
  { label: "index calendar_events_starts_ends", sql: `CREATE INDEX IF NOT EXISTS "calendar_events_starts_at_ends_at_idx" ON "calendar_events"("starts_at", "ends_at")` },
  { label: "index calendar_events_location", sql: `CREATE INDEX IF NOT EXISTS "calendar_events_location_id_idx" ON "calendar_events"("location_id")` },
  { label: "fk calendar_events_source_id", sql: `ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "calendar_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE`, ignoreError: true },
  { label: "fk calendar_events_location_id", sql: `ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE`, ignoreError: true },

  { label: "table location_mappings", sql: `CREATE TABLE IF NOT EXISTS "location_mappings" ("id" TEXT NOT NULL, "pattern" TEXT NOT NULL, "location_id" TEXT NOT NULL, "priority" INTEGER NOT NULL DEFAULT 0, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "location_mappings_pkey" PRIMARY KEY ("id"))` },
  { label: "fk location_mappings_location_id", sql: `ALTER TABLE "location_mappings" ADD CONSTRAINT "location_mappings_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE`, ignoreError: true },

  // ── Notifications ──
  { label: "table notifications", sql: `CREATE TABLE IF NOT EXISTS "notifications" ("id" TEXT NOT NULL, "user_id" TEXT NOT NULL, "type" TEXT NOT NULL, "title" TEXT NOT NULL, "body" TEXT, "payload" JSONB, "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP', "sent_at" TIMESTAMP(3), "read_at" TIMESTAMP(3), "dedupe_key" TEXT, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"))` },
  { label: "index notifications_dedupe_key", sql: `CREATE UNIQUE INDEX IF NOT EXISTS "notifications_dedupe_key_key" ON "notifications"("dedupe_key")` },
  { label: "index notifications_user_read", sql: `CREATE INDEX IF NOT EXISTS "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at")` },
  { label: "index notifications_type_created", sql: `CREATE INDEX IF NOT EXISTS "notifications_type_created_at_idx" ON "notifications"("type", "created_at")` },

  // ── Migration 0005: Categories ──
  { label: "table categories", sql: `CREATE TABLE IF NOT EXISTS "categories" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, "parent_id" TEXT, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "categories_pkey" PRIMARY KEY ("id"))` },
  { label: "index categories_parent_id", sql: `CREATE INDEX IF NOT EXISTS "categories_parent_id_idx" ON "categories"("parent_id")` },
  { label: "index categories_name_parent", sql: `CREATE UNIQUE INDEX IF NOT EXISTS "categories_name_parent_id_key" ON "categories"("name", "parent_id")` },
  { label: "fk categories_parent_id", sql: `ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE`, ignoreError: true },

  { label: "col assets.category_id", sql: `ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "category_id" TEXT` },
  { label: "index assets_category_id", sql: `CREATE INDEX IF NOT EXISTS "assets_category_id_idx" ON "assets"("category_id")` },
  { label: "fk assets_category_id", sql: `ALTER TABLE "assets" ADD CONSTRAINT "assets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE`, ignoreError: true },

  { label: "col bulk_skus.category_id", sql: `ALTER TABLE "bulk_skus" ADD COLUMN IF NOT EXISTS "category_id" TEXT` },
  { label: "index bulk_skus_category_id", sql: `CREATE INDEX IF NOT EXISTS "bulk_skus_category_id_idx" ON "bulk_skus"("category_id")` },
  { label: "fk bulk_skus_category_id", sql: `ALTER TABLE "bulk_skus" ADD CONSTRAINT "bulk_skus_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE`, ignoreError: true },

  // ── Migration 0006: Asset policy toggles ──
  { label: "col assets.available_for_reservation", sql: `ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "available_for_reservation" BOOLEAN NOT NULL DEFAULT true` },
  { label: "col assets.available_for_checkout", sql: `ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "available_for_checkout" BOOLEAN NOT NULL DEFAULT true` },
  { label: "col assets.available_for_custody", sql: `ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "available_for_custody" BOOLEAN NOT NULL DEFAULT true` },
  { label: "col assets.link_url", sql: `ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "link_url" TEXT` },
];

/**
 * POST /api/migrate
 * Runs all migrations step-by-step (idempotent). Admin only.
 * Returns per-step results so failures are easy to diagnose.
 */
export async function POST() {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN") {
      throw new HttpError(403, "Only admins can run migrations");
    }

    const results: { label: string; status: "ok" | "skipped" | "error"; error?: string }[] = [];

    for (const step of STEPS) {
      try {
        await db.$executeRawUnsafe(step.sql);
        results.push({ label: step.label, status: "ok" });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (step.ignoreError) {
          results.push({ label: step.label, status: "skipped", error: msg });
        } else {
          results.push({ label: step.label, status: "error", error: msg });
          // Stop on hard failure
          return ok({
            message: `Migration failed at step: ${step.label}`,
            results,
          }, 500);
        }
      }
    }

    const errors = results.filter((r) => r.status === "error");
    return ok({
      message: errors.length > 0
        ? `Completed with ${errors.length} error(s)`
        : "Migration completed successfully",
      results,
    });
  } catch (error) {
    return fail(error);
  }
}
