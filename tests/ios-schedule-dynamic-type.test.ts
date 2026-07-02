import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

function sliceBetween(sourceText: string, start: string, end: string) {
  const startIndex = sourceText.indexOf(start);
  const endIndex = sourceText.indexOf(end, startIndex);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return sourceText.slice(startIndex, endIndex);
}

describe("iOS Schedule Dynamic Type", () => {
  it("uses semantic fonts in the visible list date header", () => {
    const scheduleView = source("ios/Wisconsin/Views/ScheduleView.swift");
    const dateHeader = sliceBetween(
      scheduleView,
      "private struct ScheduleDateHeader: View",
      "// MARK: - Event Row",
    );

    expect(dateHeader).toContain(".font(.subheadline.weight(.semibold))");
    expect(dateHeader).toContain(".font(.caption)");
    expect(dateHeader).not.toContain(".font(.system(size:");
    expect(dateHeader).not.toContain(".font(.title2.weight(.bold))");
    expect(dateHeader).not.toContain(".frame(width: 44)");
  });

  it("keeps schedule row microcopy on semantic Dynamic Type styles", () => {
    const scheduleView = source("ios/Wisconsin/Views/ScheduleView.swift");
    const eventRow = sliceBetween(
      scheduleView,
      "struct EventRow: View",
      "private func calendarSame",
    );

    expect(eventRow).toContain(".font(.caption.weight(.semibold))");
    expect(eventRow).toContain(".font(.caption.weight(.semibold).monospacedDigit())");
    expect(eventRow).toContain(".font(.subheadline)");
    expect(eventRow).not.toContain(".font(.system(size:");
  });
});
