#!/usr/bin/env node
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

try {
  // 1. Verify recorded checksum matches our migration file (so future deploys don't error).
  const sql = readFileSync("prisma/migrations/0086_booking_pickup_kiosk/migration.sql");
  const localChecksum = createHash("sha256").update(sql).digest("hex");
  const recorded = await db.$queryRawUnsafe(
    `SELECT checksum::text AS checksum, applied_steps_count FROM _prisma_migrations WHERE migration_name='0086_booking_pickup_kiosk'`
  );
  console.log("local file sha256:", localChecksum);
  console.log("recorded:", JSON.stringify(recorded));
  console.log("checksum match:", recorded[0]?.checksum === localChecksum);

  // 2. Set a test pickup kiosk on the Chris Hall checkout (Video Office @ Camp Randall).
  const KIOSK_ID = "cmqpo10qp0001ie04qcr4j7yf";
  const BOOKING_ID = "cmqtly4xh0003ld04djioboay";
  const n = await db.$executeRawUnsafe(
    `UPDATE bookings SET pickup_kiosk_device_id=$1 WHERE id=$2`,
    KIOSK_ID,
    BOOKING_ID,
  );
  console.log("rows updated:", n);
} finally {
  await db.$disconnect();
}
