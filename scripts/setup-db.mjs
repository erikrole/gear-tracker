/**
 * One-step database setup script.
 * Creates all tables, constraints, indexes, and seeds the admin user.
 *
 * Usage:  node scripts/setup-db.mjs
 *
 * Requires DATABASE_URL in .env or as an environment variable.
 */
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set. Add it to your .env file.");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

// ─── Step 1: Create enums ───────────────────────────────────────────────────
const createEnums = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role') THEN
    CREATE TYPE "Role" AS ENUM ('ADMIN', 'STAFF', 'STUDENT');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AssetStatus') THEN
    CREATE TYPE "AssetStatus" AS ENUM ('AVAILABLE', 'MAINTENANCE', 'RETIRED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BookingKind') THEN
    CREATE TYPE "BookingKind" AS ENUM ('RESERVATION', 'CHECKOUT');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BookingStatus') THEN
    CREATE TYPE "BookingStatus" AS ENUM ('DRAFT', 'BOOKED', 'OPEN', 'COMPLETED', 'CANCELLED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AllocationKind') THEN
    CREATE TYPE "AllocationKind" AS ENUM ('RESERVATION', 'CHECKOUT');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BulkMovementKind') THEN
    CREATE TYPE "BulkMovementKind" AS ENUM ('CHECKOUT', 'CHECKIN', 'ADJUSTMENT');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ScanType') THEN
    CREATE TYPE "ScanType" AS ENUM ('SERIALIZED', 'BULK_BIN');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ScanPhase') THEN
    CREATE TYPE "ScanPhase" AS ENUM ('CHECKOUT', 'CHECKIN');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ScanSessionStatus') THEN
    CREATE TYPE "ScanSessionStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELLED');
  END IF;
END $$;
`;

// ─── Step 2: Create tables ──────────────────────────────────────────────────
const createTables = `
CREATE TABLE IF NOT EXISTS "locations" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "locations_name_key" ON "locations"("name");

CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "location_id" TEXT REFERENCES "locations"("id") ON DELETE SET NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");

CREATE TABLE IF NOT EXISTS "sessions" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_token_hash_key" ON "sessions"("token_hash");
CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions"("user_id");

CREATE TABLE IF NOT EXISTS "assets" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "asset_tag" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "serial_number" TEXT NOT NULL,
    "qr_code_value" TEXT NOT NULL,
    "purchase_date" TIMESTAMP(3),
    "purchase_price" DECIMAL(10,2),
    "location_id" TEXT NOT NULL REFERENCES "locations"("id"),
    "status" "AssetStatus" NOT NULL DEFAULT 'AVAILABLE',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "assets_asset_tag_key" ON "assets"("asset_tag");
CREATE UNIQUE INDEX IF NOT EXISTS "assets_serial_number_key" ON "assets"("serial_number");
CREATE UNIQUE INDEX IF NOT EXISTS "assets_qr_code_value_key" ON "assets"("qr_code_value");
CREATE INDEX IF NOT EXISTS "assets_location_id_idx" ON "assets"("location_id");
CREATE INDEX IF NOT EXISTS "assets_brand_model_idx" ON "assets"("brand", "model");

CREATE TABLE IF NOT EXISTS "bookings" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "kind" "BookingKind" NOT NULL,
    "title" TEXT NOT NULL,
    "requester_user_id" TEXT NOT NULL REFERENCES "users"("id"),
    "location_id" TEXT NOT NULL REFERENCES "locations"("id"),
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "status" "BookingStatus" NOT NULL,
    "created_by" TEXT NOT NULL REFERENCES "users"("id"),
    "notes" TEXT,
    "source_reservation_id" TEXT REFERENCES "bookings"("id") ON DELETE SET NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "bookings_location_id_starts_at_ends_at_idx" ON "bookings"("location_id", "starts_at", "ends_at");
CREATE INDEX IF NOT EXISTS "bookings_status_kind_idx" ON "bookings"("status", "kind");
CREATE INDEX IF NOT EXISTS "bookings_source_reservation_id_idx" ON "bookings"("source_reservation_id");

CREATE TABLE IF NOT EXISTS "booking_serialized_items" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "booking_id" TEXT NOT NULL REFERENCES "bookings"("id") ON DELETE CASCADE,
    "asset_id" TEXT NOT NULL REFERENCES "assets"("id"),
    "allocation_status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "booking_serialized_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "booking_serialized_items_asset_id_idx" ON "booking_serialized_items"("asset_id");
CREATE UNIQUE INDEX IF NOT EXISTS "booking_serialized_items_booking_id_asset_id_key" ON "booking_serialized_items"("booking_id", "asset_id");

CREATE TABLE IF NOT EXISTS "booking_bulk_items" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "booking_id" TEXT NOT NULL REFERENCES "bookings"("id") ON DELETE CASCADE,
    "bulk_sku_id" TEXT NOT NULL,
    "planned_quantity" INTEGER NOT NULL,
    "checked_out_quantity" INTEGER,
    "checked_in_quantity" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "booking_bulk_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "booking_bulk_items_bulk_sku_id_idx" ON "booking_bulk_items"("bulk_sku_id");
CREATE UNIQUE INDEX IF NOT EXISTS "booking_bulk_items_booking_id_bulk_sku_id_key" ON "booking_bulk_items"("booking_id", "bulk_sku_id");

CREATE TABLE IF NOT EXISTS "asset_allocations" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "asset_id" TEXT NOT NULL REFERENCES "assets"("id"),
    "booking_id" TEXT NOT NULL REFERENCES "bookings"("id") ON DELETE CASCADE,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "kind" "AllocationKind" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "asset_allocations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "asset_allocations_asset_id_active_idx" ON "asset_allocations"("asset_id", "active");
CREATE INDEX IF NOT EXISTS "asset_allocations_booking_id_idx" ON "asset_allocations"("booking_id");

CREATE TABLE IF NOT EXISTS "bulk_skus" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "location_id" TEXT NOT NULL REFERENCES "locations"("id"),
    "bin_qr_code_value" TEXT NOT NULL,
    "min_threshold" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bulk_skus_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "bulk_skus_location_id_active_idx" ON "bulk_skus"("location_id", "active");
CREATE UNIQUE INDEX IF NOT EXISTS "bulk_skus_location_id_bin_qr_code_value_key" ON "bulk_skus"("location_id", "bin_qr_code_value");

CREATE TABLE IF NOT EXISTS "bulk_stock_balances" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "bulk_sku_id" TEXT NOT NULL REFERENCES "bulk_skus"("id") ON DELETE CASCADE,
    "location_id" TEXT NOT NULL REFERENCES "locations"("id"),
    "on_hand_quantity" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bulk_stock_balances_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "bulk_stock_balances_bulk_sku_id_location_id_key" ON "bulk_stock_balances"("bulk_sku_id", "location_id");

CREATE TABLE IF NOT EXISTS "bulk_stock_movements" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "bulk_sku_id" TEXT NOT NULL REFERENCES "bulk_skus"("id"),
    "location_id" TEXT NOT NULL REFERENCES "locations"("id"),
    "booking_id" TEXT REFERENCES "bookings"("id") ON DELETE SET NULL,
    "actor_user_id" TEXT NOT NULL REFERENCES "users"("id"),
    "kind" "BulkMovementKind" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bulk_stock_movements_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "bulk_stock_movements_bulk_sku_id_created_at_idx" ON "bulk_stock_movements"("bulk_sku_id", "created_at");
CREATE INDEX IF NOT EXISTS "bulk_stock_movements_booking_id_idx" ON "bulk_stock_movements"("booking_id");

CREATE TABLE IF NOT EXISTS "scan_events" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "booking_id" TEXT NOT NULL REFERENCES "bookings"("id") ON DELETE CASCADE,
    "actor_user_id" TEXT NOT NULL REFERENCES "users"("id"),
    "scan_type" "ScanType" NOT NULL,
    "scan_value" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "phase" TEXT NOT NULL,
    "asset_id" TEXT REFERENCES "assets"("id") ON DELETE SET NULL,
    "bulk_sku_id" TEXT REFERENCES "bulk_skus"("id") ON DELETE SET NULL,
    "quantity" INTEGER,
    "device_context" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "scan_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "scan_events_booking_id_phase_idx" ON "scan_events"("booking_id", "phase");
CREATE INDEX IF NOT EXISTS "scan_events_scan_value_idx" ON "scan_events"("scan_value");

CREATE TABLE IF NOT EXISTS "scan_sessions" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "booking_id" TEXT NOT NULL REFERENCES "bookings"("id") ON DELETE CASCADE,
    "actor_user_id" TEXT NOT NULL REFERENCES "users"("id"),
    "phase" "ScanPhase" NOT NULL,
    "status" "ScanSessionStatus" NOT NULL DEFAULT 'OPEN',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    CONSTRAINT "scan_sessions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "scan_sessions_booking_id_phase_status_idx" ON "scan_sessions"("booking_id", "phase", "status");

CREATE TABLE IF NOT EXISTS "override_events" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "booking_id" TEXT NOT NULL REFERENCES "bookings"("id") ON DELETE CASCADE,
    "actor_user_id" TEXT NOT NULL REFERENCES "users"("id"),
    "reason" TEXT NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "override_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "override_events_booking_id_created_at_idx" ON "override_events"("booking_id", "created_at");

CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "actor_user_id" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before_json" JSONB,
    "after_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at");
`;

// ─── Step 3: Manual constraints (btree_gist exclusion) ──────────────────────
const createConstraints = `
CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'asset_allocations_no_overlap'
  ) THEN
    ALTER TABLE asset_allocations
      ADD CONSTRAINT asset_allocations_no_overlap
      EXCLUDE USING gist (
        asset_id WITH =,
        tstzrange(starts_at, ends_at, '[)') WITH &&
      )
      WHERE (active = true);
  END IF;
END $$;
`;

// ─── Step 4: Seed admin user ────────────────────────────────────────────────
async function seedAdmin() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "ChangeMeNow123!";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  // Upsert location
  const locations = await sql`
    INSERT INTO locations (id, name, address, updated_at)
    VALUES (gen_random_uuid()::text, 'Main Cage', 'Campus', CURRENT_TIMESTAMP)
    ON CONFLICT (name) DO UPDATE SET name = locations.name
    RETURNING id
  `;
  const locationId = locations[0].id;

  // Upsert admin user
  await sql`
    INSERT INTO users (id, name, email, password_hash, role, location_id, updated_at)
    VALUES (gen_random_uuid()::text, 'Gearflow Admin', 'admin@gearflow.local', ${passwordHash}, 'ADMIN', ${locationId}, CURRENT_TIMESTAMP)
    ON CONFLICT (email) DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      role = 'ADMIN',
      location_id = EXCLUDED.location_id,
      updated_at = CURRENT_TIMESTAMP
  `;
}

// ─── Run everything ─────────────────────────────────────────────────────────
async function main() {
  console.log("Step 1/4: Creating enums...");
  await sql.query(createEnums);

  console.log("Step 2/4: Creating tables & indexes...");
  // Neon HTTP driver only supports single statements per query, so split on semicolons
  const tableStatements = createTables
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const stmt of tableStatements) {
    await sql.query(stmt);
  }

  console.log("Step 3/4: Adding overlap-prevention constraint...");
  await sql.query(createConstraints);

  console.log("Step 4/4: Seeding admin user...");
  await seedAdmin();

  console.log("\nDatabase setup complete!");
  console.log("  Admin login: admin@gearflow.local / ChangeMeNow123!");
}

main().catch((err) => {
  console.error("Setup failed:", err.message);
  process.exit(1);
});
