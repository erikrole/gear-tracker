import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("schedule assign source wiring", () => {
  it("keeps assignable-user load failures from becoming false-empty picker results", () => {
    const assignPage = readFileSync("src/app/(app)/schedule/assign/_components/AssignPageClient.tsx", "utf8");
    const assignmentGrid = readFileSync("src/app/(app)/schedule/assign/_components/AssignmentGrid.tsx", "utf8");
    const assignmentCell = readFileSync("src/app/(app)/schedule/assign/_components/AssignmentCell.tsx", "utf8");
    const picker = readFileSync("src/components/shift-detail/UserAvatarPicker.tsx", "utf8");

    expect(assignPage).toContain('throw new Error(await parseErrorMessage(res, "Failed to load users"))');
    expect(assignPage).toContain('throw new Error("Users response was malformed")');
    expect(assignPage).toContain("usersLoadError");
    expect(assignPage).toContain("onRetryUsers={() => void refetchUsers()}");

    expect(assignmentGrid).toContain("usersLoadError: false | \"network\" | \"server\"");
    expect(assignmentGrid).toContain("onRetryUsers: () => void");
    expect(assignmentCell).toContain("loadError={usersLoadError}");
    expect(assignmentCell).toContain("onRetry={onRetryUsers}");

    expect(picker).toContain("loadError?: false | \"network\" | \"server\"");
    expect(picker).toContain("Could not load assignable users. Retry before assigning this slot.");
    expect(picker).toContain("Retry users");
    expect(picker).toContain("filteredUsers.length === 0");
  });

  it("gives assignment toolbar filters stable rendered metadata", () => {
    const assignPage = readFileSync("src/app/(app)/schedule/assign/_components/AssignPageClient.tsx", "utf8");

    expect(assignPage).toContain('id="assignment-sport-filter"');
    expect(assignPage).toContain('name="assignmentSportFilter"');
    expect(assignPage).toContain('aria-label="Assignment sport filter"');
    expect(assignPage).toContain('id="assignment-area-filter"');
    expect(assignPage).toContain('name="assignmentAreaFilter"');
    expect(assignPage).toContain('aria-label="Assignment area filter"');
  });
});
