import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("schedule working-copy route wiring", () => {
  it("keeps every editor operation permissioned, rate-limited, and version checked", () => {
    const route = readFileSync("src/app/api/shift-groups/[id]/working-copy/route.ts", "utf8");
    const service = readFileSync("src/lib/services/schedule-working-copy.ts", "utf8");

    expect(route).toContain('requirePermission(user.role, "shift", "manage")');
    expect(route).toContain("enforceRateLimit");
    expect(route).toContain("expectedVersion");
    expect(route).toContain("workingScheduleCommandSchema");
    expect(service).toContain("Prisma.TransactionIsolationLevel.Serializable");
    expect(service).toContain("createAuditEntryTx(tx");
    expect(service).toContain("where: { shiftGroupId, version: expectedVersion }");
  });

  it("keeps draft edits on the working route and publishes only through review", () => {
    const editor = readFileSync("src/app/(app)/schedule/_components/WorkingCrewEditor.tsx", "utf8");
    const workingService = readFileSync("src/lib/services/schedule-working-copy.ts", "utf8");

    expect(editor).toContain("/working-copy");
    expect(editor).toContain("expectedWorkingVersion");
    expect(editor).toContain("will each receive one event summary");
    expect(editor).toContain('type: "setCallWindow"');
    expect(editor).toContain("Private until this schedule is published.");
    expect(editor).toContain("data?.assignedUsers");
    expect(workingService).toContain("assignedUsers");
    expect(workingService).toContain("where: { id: { in: assignedUserIds } }");
    expect(workingService).not.toContain("sendPush");
    expect(workingService).not.toContain("sendEmail");
  });

  it("ranks working-copy assignment candidates from the effective draft slot", () => {
    const scoreRoute = readFileSync(
      "src/app/api/shift-groups/[id]/working-copy/candidate-scores/route.ts",
      "utf8",
    );
    const editor = readFileSync("src/app/(app)/schedule/_components/WorkingCrewEditor.tsx", "utf8");
    const picker = readFileSync("src/components/shift-detail/UserAvatarPicker.tsx", "utf8");
    const workingService = readFileSync("src/lib/services/schedule-working-copy.ts", "utf8");

    expect(scoreRoute).toContain('requirePermission(user.role, "shift", "manage")');
    expect(scoreRoute).toContain("getWorkingScheduleCandidateScores");
    expect(workingService).toContain("getCandidateScoresForTarget");
    expect(workingService).toContain("sportCode: group.event.sportCode");
    expect(editor).toContain("/working-copy/candidate-scores?slotKey=");
    expect(editor).toContain("candidateScores=");
    expect(picker).toContain("candidateScores[b.id]?.score");
    expect(picker).toContain('className="h-60 max-h-[var(--radix-popover-content-available-height)]"');
  });
});
