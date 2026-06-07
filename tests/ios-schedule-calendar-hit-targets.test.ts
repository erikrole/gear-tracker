import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

describe("iOS schedule calendar hit targets", () => {
  it("keeps calendar day buttons at the 44pt touch target baseline", () => {
    const scheduleView = source("ios/Wisconsin/Views/ScheduleView.swift");

    expect(scheduleView).toContain("Button {\n                            withAnimation(.easeInOut(duration: 0.15))");
    expect(scheduleView).toContain("DayCell(");
    expect(scheduleView).toContain(".frame(minWidth: 44, minHeight: 52)");
    expect(scheduleView).toContain(".contentShape(Rectangle())");
    expect(scheduleView).toContain(".accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)");
  });
});
