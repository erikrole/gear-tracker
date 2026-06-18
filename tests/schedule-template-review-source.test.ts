import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("schedule template review source contract", () => {
  it("keeps template review backend safe while the UI affordance is retired", () => {
    const route = readFileSync("src/app/api/shift-groups/[id]/template-review/route.ts", "utf8");
    const service = readFileSync("src/lib/services/schedule-template-review.ts", "utf8");
    const eventCrew = readFileSync("src/app/(app)/events/[id]/_components/ShiftCoverageCard.tsx", "utf8");
    const shiftDetail = readFileSync("src/components/ShiftDetailPanel.tsx", "utf8");

    expect(route).toContain('requirePermission(user.role, "shift", "manage")');
    expect(route).toContain("getScheduleTemplateReview(params.id)");
    expect(route).toContain("applyCopyForwardCrew(params.id");

    expect(service).toContain("directAssignShift(proposal.shiftId, proposal.userId, actor.id)");
    expect(service).toContain("Manual slots are preserved");
    expect(service).toContain("No earlier staffed event matched this sport.");
    expect(service).not.toContain("deleteMany");
    expect(service).not.toContain("updateMany({");

    expect(eventCrew).not.toContain("CrewTemplateReviewButton");
    expect(shiftDetail).not.toContain("CrewTemplateReviewButton");
    expect(eventCrew).not.toContain("Review template");
    expect(shiftDetail).not.toContain("Review template");
  });
});
