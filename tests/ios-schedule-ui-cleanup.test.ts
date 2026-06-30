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

describe("iOS Schedule UI cleanup", () => {
  it("keeps dense filters behind one native filter sheet", () => {
    const scheduleView = source("ios/Wisconsin/Views/ScheduleView.swift");
    const controlStrip = sliceBetween(
      scheduleView,
      "private var scheduleControlStrip: some View",
      "private func subscribeToCalendar() async",
    );
    const filterSheet = sliceBetween(
      scheduleView,
      "private struct ScheduleFilterSheet",
      "// MARK: - Calendar View",
    );

    expect(scheduleView).toContain("@State private var showFilters = false");
    expect(scheduleView).toContain(".sheet(isPresented: $showFilters)");
    expect(scheduleView).toContain("private struct ScheduleFilterSheet");
    expect(scheduleView).toContain("Toggle(isOn: $myShiftsOnly)");
    expect(scheduleView).toContain("Label(\"Past events\"");
    expect(scheduleView).toContain("Picker(\"Venue\", selection: $homeAwayFilter)");
    expect(scheduleView).toContain("Picker(\"Sport\", selection: sportSelection)");
    expect(scheduleView).toContain("activeFilterSummary");
    expect(scheduleView).not.toContain("FilterChip(");
    expect(controlStrip).toContain(".buttonStyle(.plain)");
    expect(controlStrip).toContain(".foregroundStyle(Color.primary)");
    expect(controlStrip).toContain(".background(Color.cardSurfaceRaised, in: Capsule())");
    expect(controlStrip).toContain(".padding(.bottom, Brand.Space.xs)");
    expect(controlStrip).not.toContain(".buttonStyle(.bordered)");
    expect(filterSheet).toContain("ToolbarItem(placement: .cancellationAction)");
    expect(filterSheet).toContain("Button(\"Clear\") { onClear() }");
    expect(filterSheet).toContain("ToolbarItem(placement: .confirmationAction)");
    expect(filterSheet).toContain("Button(\"Done\") { dismiss() }");
  });

  it("calms row color and preserves tab-bar scroll clearance", () => {
    const scheduleView = source("ios/Wisconsin/Views/ScheduleView.swift");
    const eventRow = sliceBetween(
      scheduleView,
      "struct EventRow: View",
      "private func calendarSame",
    );

    expect(scheduleView.match(/contentMargins\(\.bottom, 96, for: \.scrollContent\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(scheduleView).toContain(".strokeBorder(Color.hairline, lineWidth: 0.5)");
    expect(scheduleView).toContain("Text(\"My shift\")");
    expect(eventRow).toContain(".background(Color.cardSurface)");
    expect(eventRow).toContain(".foregroundStyle(Color.statusText(.blue))");
    expect(eventRow).not.toContain("Color.brandPrimary.opacity(0.05)");
    expect(scheduleView).not.toContain("myShift != nil ? Color.statusText(.blue) : Color.hairline");
    expect(scheduleView).not.toContain(".foregroundStyle(Color.statusText(.purple))");
  });

  it("keeps the calendar surface aligned with the list surface", () => {
    const scheduleView = source("ios/Wisconsin/Views/ScheduleView.swift");

    expect(scheduleView).toContain("showCoverage: canSeePastEvents");
    expect(scheduleView).toContain("let showCoverage: Bool");
    expect(scheduleView).toContain("showCoverage: showCoverage");
    expect(scheduleView).toContain(".background(Color.cardSurfaceRaised, in: Circle())");
    expect(scheduleView).toContain(".listRowBackground(Color.clear)");
    expect(scheduleView).toContain("LegendDot(color: Color.statusText(.blue), label: \"My shift\")");
  });

  it("keeps Event detail quieter while preserving staff actions", () => {
    const eventDetail = source("ios/Wisconsin/Views/EventDetailSheet.swift");
    const crewSection = sliceBetween(
      eventDetail,
      "private var crewSection: some View",
      "    @ViewBuilder\n    private var crewBody",
    );
    const sectionHeader = sliceBetween(
      eventDetail,
      "private struct EventDetailSectionHeader",
      "// MARK: - Coverage Pill",
    );
    const shiftRow = sliceBetween(
      eventDetail,
      "struct ShiftRow: View",
      "// MARK: - Edit Shift Times Sheet",
    );

    expect(eventDetail).toContain("Text(\"Event\")");
    expect(eventDetail).toContain(".font(.title3.weight(.semibold))");
    expect(eventDetail).toContain("ToolbarItem(placement: .cancellationAction)");
    expect(eventDetail).toContain("Button(\"Done\") { dismiss() }");
    expect(eventDetail).toContain("ToolbarItem(placement: .topBarTrailing)");
    expect(eventDetail).toContain("Label(\"Add shift\", systemImage: \"plus\")");
    expect(eventDetail).toContain(".labelStyle(.titleAndIcon)");
    expect(eventDetail).not.toContain("ToolbarItem(placement: .topBarLeading)");
    expect(eventDetail).not.toContain("ToolbarItem(placement: .bottomBar)");
    expect(crewSection).toContain("EventDetailSectionHeader(title: \"Crew\", systemImage: \"person.2.fill\")");
    expect(crewSection).toContain("CoveragePill(coverage: coverage)");
    expect(crewSection).not.toContain("Label(\"Add shift\"");
    expect(crewSection).not.toContain(".labelStyle(.iconOnly)");
    expect(crewSection).not.toContain(".buttonStyle(.bordered)");
    expect(sectionHeader).toContain(".foregroundStyle(.secondary)");
    expect(sectionHeader).toContain(".accessibilityAddTraits(.isHeader)");
    expect(sectionHeader).not.toContain(".accessibilityElement(children: .combine)");
    expect(shiftRow).toContain("Text(\"You\")");
    expect(shiftRow).toContain("Color.statusBackground(.blue)");
    expect(shiftRow).not.toContain("Color.statusText(.blue).opacity(0.06)");
    expect(shiftRow).not.toContain(".frame(width: 7, height: 7)");
  });
});
