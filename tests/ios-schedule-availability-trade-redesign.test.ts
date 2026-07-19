import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

describe("native Schedule availability and Trade Board redesign", () => {
  it("makes weekly availability interactive and existing blocks editable", () => {
    const view = source("ios/Wisconsin/Views/AvailabilityView.swift");
    const client = source("ios/Wisconsin/Core/APIClient.swift");
    const updateRoute = source("src/app/api/users/[id]/availability/[blockId]/route.ts");

    expect(view).toContain("AvailabilityWeekStrip(");
    expect(view).toContain("@Binding var selectedDay: Int");
    expect(view).toContain("editorContext = .edit(block)");
    expect(view).toContain("context.block == nil ? \"Add Availability\" : \"Edit Availability\"");
    expect(view).toContain("stride(from: 0, through: 23 * 60 + 45, by: 15)");
    expect(view).toContain("One-time exceptions");
    expect(client).toContain("func updateAvailabilityBlock(");
    expect(client).toContain("/availability/\\(blockId)\", method: \"PATCH\"");
    expect(updateRoute).toContain("export const PATCH");
    expect(updateRoute).toContain("recomputeFutureAssignmentAvailabilityConflictsForUser(id)");
  });

  it("keeps Availability in the Schedule flow for Student workers", () => {
    const schedule = source("ios/Wisconsin/Views/ScheduleView.swift");

    expect(schedule).toContain("session.currentUser?.staffingType == \"ST\"");
    expect(schedule).toContain("Label(\"My Availability\", systemImage: \"calendar.badge.clock\")");
    expect(schedule).toContain(".navigationDestination(isPresented: $showAvailability)");
    expect(schedule).toContain("AvailabilityView(userId: session.currentUser?.id ?? \"\")");
  });

  it("prioritizes actionable shifts and keeps My Posts a quiet scope", () => {
    const board = source("ios/Wisconsin/Views/Schedule/TradeBoardSheet.swift");

    expect(board).toContain("@State private var mineOnly = false");
    expect(board).toContain("TradeBoardSummaryCard(");
    expect(board).toContain("Show my trade posts");
    expect(board).toContain("private var availableContent");
    expect(board).toContain("private var myPostsContent");
    expect(board).toContain("dateTimeLine");
    expect(board).toContain("classificationColor");
    expect(board).toContain(".buttonStyle(.borderedProminent)");
    expect(board).toContain("cancelAction: nil");
    expect(board).not.toContain("} cancelAction: {}");
  });

  it("prevents duplicate trade mutations and preserves recovery", () => {
    const board = source("ios/Wisconsin/Views/Schedule/TradeBoardSheet.swift");

    expect(board).toContain("@State private var pendingActionId: String?");
    expect(board).toContain("pendingActionId = item.id");
    expect(board).toContain("pendingActionId = trade.id");
    expect(board).toContain(".disabled(isActioning)");
    expect(board).toContain("TradeBoardActionErrorBanner(");
  });
});
