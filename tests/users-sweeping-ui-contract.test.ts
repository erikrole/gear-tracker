import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

describe("Users sweeping ownership contracts", () => {
  it("shows canonical roles and accessible sort state in the roster", () => {
    const page = source("src/app/(app)/users/page.tsx");
    const row = source("src/app/(app)/users/UserRow.tsx");

    expect(row).toContain("<RoleBadge role={user.role} />");
    expect(row).not.toContain("listRoleLabel");
    expect(page).toContain('aria-sort={isAsc ? "ascending" : isDesc ? "descending" : "none"}');
  });

  it("keeps onboarding direct and viewport-safe", () => {
    const users = source("src/app/(app)/users/page.tsx");
    const status = source("src/app/(app)/users/onboarding-status/page.tsx");
    const dialog = source("src/components/onboarding/OnboardingDialog.tsx");

    expect(status).toContain('href="/users?onboard=1"');
    expect(users).toContain('"onboard"');
    expect(dialog).toContain("max-h-[calc(100dvh-2rem)]");
    expect(dialog).toContain("min-h-0 overflow-y-auto");
  });

  it("confirms availability deletion before the destructive request", () => {
    const availability = source("src/app/(app)/users/[id]/UserAvailabilityTab.tsx");

    expect(availability).toContain("const confirm = useConfirm()");
    expect(availability).toContain('title: "Remove availability?"');
    expect(availability.indexOf("await confirm(")).toBeLessThan(availability.indexOf('method: "DELETE"'));
  });

  it("keeps cyclic legacy org-chart users visible", () => {
    const orgChart = source("src/app/(app)/users/org-chart/page.tsx");

    expect(orgChart).toContain("Corrupt legacy cycles have no natural root");
    expect(orgChart).toContain("if (!included.has(user.id))");
  });

  it("makes avatar replacement and removal database-first", () => {
    const avatar = source("src/app/api/users/[id]/avatar/route.ts");
    const firstUpdate = avatar.indexOf("updated = await db.user.update");
    const firstDelete = avatar.indexOf("await deleteImage(target.avatarUrl)");
    const removeUpdate = avatar.lastIndexOf("await db.user.update");
    const removeDelete = avatar.lastIndexOf("await deleteImage(target.avatarUrl)");

    expect(firstUpdate).toBeGreaterThan(-1);
    expect(firstUpdate).toBeLessThan(firstDelete);
    expect(removeUpdate).toBeLessThan(removeDelete);
  });
});
