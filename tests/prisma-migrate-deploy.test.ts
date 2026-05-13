import { describe, expect, it } from "vitest";

// The deploy wrapper is a plain ESM Node script, but the splitter is exported for regression coverage.
// @ts-expect-error no declaration file for local .mjs script modules
import { splitSqlStatements } from "../scripts/prisma-migrate-deploy.mjs";

describe("splitSqlStatements", () => {
  it("keeps semicolons inside strings and comments", () => {
    expect(
      splitSqlStatements(`
        -- comment with ; inside
        INSERT INTO "system_config" ("key", "value")
        VALUES ('copy;inside', '{"x":"a;b"}'::jsonb);
        /* block ; comment */
        CREATE INDEX IF NOT EXISTS "idx_demo" ON "demo"("value");
      `),
    ).toEqual([
      `-- comment with ; inside
        INSERT INTO "system_config" ("key", "value")
        VALUES ('copy;inside', '{"x":"a;b"}'::jsonb)`,
      `/* block ; comment */
        CREATE INDEX IF NOT EXISTS "idx_demo" ON "demo"("value")`,
    ]);
  });

  it("keeps dollar-quoted blocks together", () => {
    expect(
      splitSqlStatements(`
        DO $$
        BEGIN
          RAISE NOTICE 'hello; still inside';
        END $$;
        ALTER TABLE "bookings" ADD COLUMN "completed_at" TIMESTAMP(3);
      `),
    ).toEqual([
      `DO $$
        BEGIN
          RAISE NOTICE 'hello; still inside';
        END $$`,
      `ALTER TABLE "bookings" ADD COLUMN "completed_at" TIMESTAMP(3)`,
    ]);
  });
});
