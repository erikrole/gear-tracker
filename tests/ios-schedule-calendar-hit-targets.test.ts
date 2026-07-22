import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

describe("iOS schedule calendar hit targets", () => {
  // Calendar day cells intentionally sit below Apple's 44pt guidance: a six-row
  // month at 44pt occupied over half the screen and starved the agenda below it.
  // The cell stays fully tappable via contentShape; this guard keeps it from
  // shrinking further and keeps the accessibility traits attached.
  it("keeps calendar day buttons tappable at the compact 32pt floor", () => {
    const scheduleView = source("ios/Wisconsin/Views/ScheduleView.swift");

    expect(scheduleView).toContain("Button {\n                            withAnimation(.easeInOut(duration: 0.15))");
    expect(scheduleView).toContain("DayCell(");
    expect(scheduleView).toContain(".frame(minWidth: 32, minHeight: 32)");
    expect(scheduleView).toContain(".contentShape(Rectangle())");
    expect(scheduleView).toContain(".accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)");
  });
});
