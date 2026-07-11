import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
// The bootstrapper is a plain ESM Node script with exported guards for regression coverage.
// @ts-expect-error no declaration file for local .mjs script modules
import { assertBootstrapSafe, generateBaselineSql } from "../scripts/bootstrap-empty-database.mjs";

describe("empty database bootstrap", () => {
  it("allows only a truly empty target or Prisma migration metadata", () => {
    expect(() => assertBootstrapSafe([])).not.toThrow();
    expect(() => assertBootstrapSafe(["_prisma_migrations"])).not.toThrow();
    expect(() => assertBootstrapSafe(["users"])).toThrow("target is not empty (users)");
  });

  it("generates the current schema baseline without a database connection", () => {
    const sql = generateBaselineSql();
    expect(sql).toContain('CREATE TABLE "users"');
    expect(sql).toContain('CREATE TABLE "asset_allocations"');
    expect(sql).not.toContain("postgresql://");
  });

  it("keeps the timestamp exclusion compatible with Prisma's timestamp columns", () => {
    const source = readFileSync(path.join(process.cwd(), "scripts/bootstrap-empty-database.mjs"), "utf8");
    expect(source).toContain("tsrange(starts_at, ends_at, '[)')");
    expect(source).not.toContain("tstzrange(starts_at, ends_at, '[)')");
    expect(source).toContain("await sql.transaction(");
  });
});
