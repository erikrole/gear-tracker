#!/usr/bin/env node

import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required to check active allocation duplicates.");
  process.exit(1);
}

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

try {
  const dupes = await db.$queryRaw`
    SELECT
      a.asset_id,
      ast.asset_tag,
      ast.name AS asset_name,
      a.id AS allocation_id,
      a.booking_id,
      a.kind,
      a.starts_at,
      a.ends_at,
      b.ref_number,
      b.status AS booking_status,
      b.kind AS booking_kind,
      u.name AS requester
    FROM asset_allocations a
    JOIN assets ast ON ast.id = a.asset_id
    JOIN bookings b ON b.id = a.booking_id
    LEFT JOIN users u ON u.id = b.requester_user_id
    WHERE a.active = TRUE
      AND a.asset_id IN (
        SELECT asset_id FROM asset_allocations
        WHERE active = TRUE
        GROUP BY asset_id HAVING COUNT(*) > 1
      )
    ORDER BY a.asset_id, a.starts_at;
  `;

  if (dupes.length === 0) {
    console.log("OK: no duplicate active serialized allocations found.");
  } else {
    console.error(`Found ${dupes.length} duplicate active allocation rows:`);
    console.error(JSON.stringify(dupes, null, 2));
    process.exitCode = 1;
  }
} finally {
  await db.$disconnect();
}
