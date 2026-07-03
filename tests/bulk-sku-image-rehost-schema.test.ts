import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync(
  "prisma/migrations/0077_add_bulk_sku_image_rehost_attempts/migration.sql",
  "utf8",
);
const cronRoute = readFileSync("src/app/api/cron/rehost-images/route.ts", "utf8");

describe("BulkSku image rehost schema contract", () => {
  it("keeps the Prisma model aligned with the applied image retry migration", () => {
    expect(schema).toMatch(
      /model BulkSku \{[\s\S]*imageRehostAttempts\s+Int\s+@default\(0\)\s+@map\("image_rehost_attempts"\)/,
    );
    expect(migration).toContain('"image_rehost_attempts" INTEGER NOT NULL DEFAULT 0');
  });

  it("keeps item-family image rehosting bounded by the retry counter", () => {
    expect(cronRoute).toMatch(
      /db\.bulkSku\.findMany\(\{[\s\S]*imageRehostAttempts: \{ lt: MAX_ATTEMPTS \}/,
    );
    expect(cronRoute).toMatch(
      /db\.bulkSku\.count\(\{[\s\S]*imageRehostAttempts: \{ lt: MAX_ATTEMPTS \}/,
    );
    expect(cronRoute).toMatch(
      /db\.bulkSku\.update\(\{[\s\S]*data: \{ imageRehostAttempts: \{ increment: 1 \} \}/,
    );
  });
});
