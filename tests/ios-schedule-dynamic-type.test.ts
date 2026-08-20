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
    // The header is one line now: the date sits at .subheadline beside the day
    // name, and .caption carries the trailing event count with tabular figures.
    expect(dateHeader).toContain(".font(.subheadline)");
    expect(dateHeader).toContain(".font(.caption.monospacedDigit())");
    expect(dateHeader).not.toContain(".font(.system(size:");
    expect(dateHeader).not.toContain(".font(.title2.weight(.bold))");
    expect(dateHeader).not.toContain(".frame(width: 44)");
  });

  it("keeps schedule row microcopy on semantic Dynamic Type styles", () => {
    const scheduleView = source("ios/Wisconsin/Views/ScheduleView.swift");
    const crewRow = source("ios/Wisconsin/Views/Components/CrewRow.swift");
    const eventRow = sliceBetween(
      scheduleView,
      "struct EventRow: View",
      "private func calendarSame",
    );

    // The personal work line carries the wearer's own call time, so it sits a
    // step up from .caption now that the row has a line to spare.
    expect(eventRow).toContain(".font(.footnote.weight(.semibold))");
    expect(eventRow).toContain(".font(.subheadline)");
    // Leading time gutter: semantic styles with tabular figures so the column
    // stays aligned as Dynamic Type scales.
    expect(eventRow).toContain(".font(.subheadline.weight(.semibold).monospacedDigit())");
    expect(eventRow).toContain(".font(.caption.monospacedDigit())");
    expect(eventRow).not.toContain(".font(.system(size:");
    // The row's coverage chip is now the shared CoverageChip, so its tabular
    // figures live there -- same semantic style, one definition instead of two.
    expect(crewRow).toContain(".font(.caption.weight(.semibold).monospacedDigit())");
    expect(crewRow).not.toContain(".font(.system(size:");
  });
});
