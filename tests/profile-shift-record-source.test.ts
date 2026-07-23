import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("personal shift record profile clients", () => {
  it("keeps the web profile numeric, coverage-aware, and expandable by sport", () => {
    const page = source("src/app/(app)/users/[id]/page.tsx");
    const card = source("src/app/(app)/users/[id]/ShiftRecordCard.tsx");

    expect(page).toContain("<ShiftRecordCard userId={id} />");
    expect(card).toContain("`${data.wins}-${data.losses}`");
    expect(card).toContain("data.resultEventCount < data.shiftCount");
    expect(card).toContain("results recorded from");
    expect(card).toContain("No game results recorded.");
    expect(card).toContain("<Collapsible");
    expect(card).toContain("data.bySport.map");
    expect(card).not.toContain("COLLABORATOR");
  });

  it("decodes the numeric contract and loads it only for full native profiles", () => {
    const models = source("ios/Wisconsin/Models/Models.swift");
    const api = source("ios/Wisconsin/Core/APIClient.swift");
    const detail = source("ios/Wisconsin/Views/UserDetailView.swift");

    for (const field of ["shiftCount", "resultEventCount", "wins", "losses", "bySport"]) {
      expect(models).toContain(`let ${field}:`);
    }
    expect(api).toContain('request(path: "/api/users/\\(userId)/shift-record")');
    expect(api).toContain("DataWrapper<ShiftRecordStats>");
    expect(detail).toContain("if !isCollaboratorDirectoryViewer");
    expect(detail).toContain("async let shiftRecordTask = loadShiftRecordSafely()");
    expect(detail).toContain("ShiftRecordCard(stats: shiftRecord)");
    expect(detail).toContain("stats.resultEventCount < stats.shiftCount");
    expect(detail).toContain("No game results recorded.");
    expect(detail).toContain('DisclosureGroup("By sport"');
  });
});
