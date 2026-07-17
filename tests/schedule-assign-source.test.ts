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
    expect(assignmentCell).toContain("/api/shifts/${shiftId}/candidate-scores");
    expect(assignmentCell).toContain("setConflictMap(Object.fromEntries(");

    expect(picker).toContain("loadError?: false | \"network\" | \"server\"");
    expect(picker).toContain("Could not load assignable users. Retry before assigning this slot.");
    expect(picker).toContain("Retry users");
    expect(picker).toContain("filteredUsers.length === 0");
    expect(picker).toContain("SCORE_BUCKET_LABELS");
    expect(picker).toContain("Scoring candidates...");
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

  it("keeps auto-fill preview-first before assignment mutation", () => {
    const eventCrew = readFileSync("src/app/(app)/events/[id]/_components/ShiftCoverageCard.tsx", "utf8");
    const shiftDetail = readFileSync("src/components/ShiftDetailPanel.tsx", "utf8");

    expect(eventCrew).toContain("/api/shift-groups/${groupId}/auto-assign/preview");
    expect(eventCrew).toContain("Apply recommended assignments");
    expect(eventCrew).toContain("Review the proposed crew changes before applying them.");

    expect(shiftDetail).toContain("/api/shift-groups/${group.id}/auto-assign/preview");
    expect(shiftDetail).toContain("Apply recommended assignments");
    expect(shiftDetail).toContain("Nothing changes until you apply.");
  });

  it("keeps publish and acknowledgement routes permissioned and audited", () => {
    const publishRoute = readFileSync("src/app/api/shift-groups/[id]/publish/route.ts", "utf8");
    const acknowledgeRoute = readFileSync("src/app/api/shift-assignments/[id]/acknowledge/route.ts", "utf8");

    expect(publishRoute).toContain('requirePermission(user.role, "shift", "manage")');
    expect(publishRoute).toContain("publishShiftGroup(params.id, user.id)");
    expect(publishRoute).toContain("createAuditEntry");
    expect(publishRoute).toContain('"shift_group_republished"');
    expect(publishRoute).toContain('"shift_group_published"');

    expect(acknowledgeRoute).toContain("acknowledgeShiftAssignment(params.id");
    expect(acknowledgeRoute).toContain("createAuditEntry");
    expect(acknowledgeRoute).toContain('"shift_assignment_acknowledged"');
    expect(acknowledgeRoute).toContain("acknowledgedAt: result.after.acknowledgedAt");
    expect(acknowledgeRoute).toContain("shiftGroupId: result.shiftGroupId");
  });

  it("routes assignment notifications through the publication-aware schedule policy", () => {
    const assignRoute = readFileSync("src/app/api/shift-assignments/route.ts", "utf8");
    const approveRoute = readFileSync("src/app/api/shift-assignments/[id]/approve/route.ts", "utf8");
    const assignmentRoute = readFileSync("src/app/api/shift-assignments/[id]/route.ts", "utf8");
    const shiftRoute = readFileSync("src/app/api/shifts/[id]/route.ts", "utf8");
    const conflictRefresh = readFileSync("src/lib/services/shift-assignment-conflicts.ts", "utf8");
    const publishRoute = readFileSync("src/app/api/shift-groups/[id]/publish/route.ts", "utf8");

    expect(assignRoute).toContain("dispatchScheduleAssignmentNotifications(assignment.id, \"assigned\")");
    expect(assignRoute).not.toContain("createShiftGearUpNotification(assignment.id)");
    expect(approveRoute).toContain("dispatchScheduleAssignmentNotifications(assignment.id, \"approved\")");
    expect(assignmentRoute).toContain("existing.shift?.shiftGroup?.publishedAt");
    expect(assignmentRoute).toContain("data.acknowledgedAt = null");
    expect(shiftRoute).toContain("updateShiftAssignmentConflictsTx(");
    expect(shiftRoute).toContain("existing.shiftGroup.publishedAt !== null");
    expect(shiftRoute).toContain("scheduleShiftTimeChangedNotifications(assignmentIds)");
    expect(conflictRefresh).toContain("acknowledged_by_id");
    expect(conflictRefresh).toContain("WHEN CAST(${resetAcknowledgements} AS BOOLEAN) THEN NULL");
    expect(publishRoute).toContain("createPublishedShiftGroupNotifications(params.id)");
    expect(publishRoute).toContain("if (!result.before.publishedAt)");
  });
});
