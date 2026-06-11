import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("scripts/backfill-asset-images.mjs", "utf8");

describe("backfill-asset-images script source contract", () => {
  it("includes BulkSku image candidates in the default backlog", () => {
    expect(source).toContain("db.bulkSku.findMany");
    expect(source).toContain('toTarget("bulkSku"');
    expect(source).toContain("Bulk SKUs to re-host");
  });

  it("keeps dry-run as the default and requires --apply for writes", () => {
    expect(source).toContain('const APPLY = process.argv.includes("--apply")');
    expect(source).toContain("Mode: DRY RUN (no changes)");
    expect(source).toContain("BLOB_READ_WRITE_TOKEN is required to --apply");
  });

  it("exposes explicit scope flags for operator backfills", () => {
    expect(source).toContain("--assets-only");
    expect(source).toContain("--bulk-skus-only");
    expect(source).toContain("Choose only one scope flag");
  });
});
