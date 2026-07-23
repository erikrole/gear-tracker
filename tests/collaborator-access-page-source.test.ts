import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Collaborator Access settings response contract", () => {
  it("uses the policy array already unwrapped by useFetch", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/app/(app)/settings/collaborator-access/page.tsx"),
      "utf8",
    );

    expect(source).toContain("useFetch<Policy[]>");
    expect(source).toContain("const policies = data ?? [];");
    expect(source).not.toContain("const policies = data?.data ?? [];");
  });

  it("preserves intentional badge casing in create and edit fields", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/app/(app)/settings/collaborator-access/page.tsx"),
      "utf8",
    );

    expect(source).toContain('placeholder="Learfield"');
    expect(source).not.toContain("setBadge(event.target.value.toUpperCase())");
  });
});
