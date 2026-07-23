import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("collaborator production smoke", () => {
  const script = fs.readFileSync(
    path.join(process.cwd(), "scripts/collaborator-deploy-smoke.mjs"),
    "utf8",
  );

  it("requires disposable credentials and verifies capability, minimization, and denials", () => {
    expect(script).toContain("COLLABORATOR_SMOKE_EMAIL");
    expect(script).toContain("COLLABORATOR_SMOKE_PASSWORD");
    expect(script).toContain('includes("PEOPLE_DIRECTORY_VIEW")');
    expect(script).toContain("assertDirectoryPerson");
    expect(script).toContain("/api/users?limit=100&active=all&includeHidden=1&sort=email");
    expect(script).toContain("/activity");
    expect(script).not.toMatch(/password\s*=\s*["'][^"']+["']/);
  });
});
