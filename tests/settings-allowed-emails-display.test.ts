import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("settings allowed emails display", () => {
  it("uses product role labels and variants instead of raw role enums", () => {
    const source = readFileSync("src/app/(app)/settings/allowed-emails/page.tsx", "utf8");

    expect(source).toContain("ROLE_BADGE_META");
    expect(source).toContain('ADMIN: { label: "Admin", variant: "purple" }');
    expect(source).toContain('STAFF: { label: "Staff", variant: "blue" }');
    expect(source).toContain('STUDENT: { label: "Student", variant: "gray" }');
    expect(source).toContain("ROLE_BADGE_META[item.role].label");
    expect(source).not.toContain("{item.role}");
  });
});
