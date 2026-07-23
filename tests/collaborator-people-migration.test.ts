import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("collaborator People policy migration", () => {
  const sql = fs.readFileSync(
    path.join(process.cwd(), "prisma/migrations/0103_collaborator_people_directory/migration.sql"),
    "utf8",
  );

  it("grants BTN and Learfield idempotently and records policy revisions", () => {
    expect(sql).toContain("'BIG_TEN_NETWORK', 'LEARFIELD'");
    expect(sql).toContain("'PEOPLE_DIRECTORY_VIEW'");
    expect(sql).toContain("ON CONFLICT (policy_id, capability_key) DO NOTHING");
    expect(sql).toContain("SET version = p.version + 1");
    expect(sql).toContain("collaborator_policy_revisions");
  });
});
