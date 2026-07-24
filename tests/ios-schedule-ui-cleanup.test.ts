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
      "@ViewBuilder\n    private func eventList",
    );
    const filterSheet = sliceBetween(
      scheduleView,
      "private struct ScheduleFilterSheet",
      "// MARK: - Calendar Subscription",
    );

    expect(scheduleView).toContain("@State private var showFilters = false");
    expect(scheduleView).toContain("@State private var myShiftsOnly = false");
    expect(scheduleView).toContain(".sheet(isPresented: $showFilters)");
    expect(scheduleView).toContain("private struct ScheduleFilterSheet");
    expect(scheduleView).toContain("Toggle(isOn: $myShiftsOnly)");
    expect(scheduleView).toContain("Label(\"Include past events\"");
    expect(scheduleView).toContain("Text(\"Event Type\")");
    expect(scheduleView).toContain("ForEach(HomeAwayFilter.allCases");
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
    expect(filterSheet).toContain("Text(showResultsTitle)");
    expect(filterSheet).toContain(".safeAreaInset(edge: .bottom)");
    expect(scheduleView).toContain('case true: return "Home"');
    expect(scheduleView).toContain('case false: return "Away"');
    expect(scheduleView).toContain('case nil: return event.opponent == nil ? "Non-game" : "Neutral"');
  });

  it("gives personal work priority without stealing the venue rail", () => {
    const scheduleView = source("ios/Wisconsin/Views/ScheduleView.swift");
    const eventRow = sliceBetween(
      scheduleView,
      "struct EventRow: View",
      "private func calendarSame",
    );

    expect(scheduleView.match(/contentMargins\(\.bottom, 96, for: \.scrollContent\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(eventRow).toContain("StatusRail(color: barColor)");
    expect(eventRow).toContain("Text(eventTypeLabel)");
    expect(eventRow).toContain("Label(venueName, systemImage: \"mappin.and.ellipse\")");
    expect(eventRow).toContain("personalWorkLine(myShift)");
    expect(eventRow).toContain("parts.append(shift.gear.gearLabel)");
    expect(eventRow).toContain("myShift == nil ? Color.cardSurface : Color.statusBackground(.blue).opacity(0.34)");
    expect(eventRow).toContain(".foregroundStyle(Color.statusText(.blue))");
    expect(eventRow).toContain("if showsCrewCoverage, let cov = event.coverage");
  });

  it("keeps calendar and agenda semantics aligned", () => {
    const scheduleView = source("ios/Wisconsin/Views/ScheduleView.swift");

    expect(scheduleView.match(/EventRow\(/g)?.length).toBeGreaterThanOrEqual(2);
    expect(scheduleView).toContain("showsCrewCoverage: showsCrewCoverage");
    expect(scheduleView).toContain("coverageChip(cov)");
    expect(scheduleView).toContain("dots.contains(where: \\.isShift)");
    // Calendar dots and agenda rails must speak the same venue vocabulary.
    // They used to assert it by each spelling out green/orange/grey inline,
    // which is what let the two drift onto different greys; both now read the
    // shared `venueRailColor`, so alignment is structural rather than asserted.
    expect(scheduleView).toContain("DotInfo(color: venueRailColor(isHome: event.isHome)");
    expect(scheduleView).toMatch(
      /private var barColor: Color \{\s*venueRailColor\(isHome: event\.isHome\)/,
    );
    // Month arrows are deliberately unfilled (no raised circle) and compact so
    // the header reads lighter above a dense grid. Asserting their exact frame
    // would be a false positive -- the toolbar buttons share that string.
    expect(scheduleView).toContain('.accessibilityLabel("Previous month")');
    expect(scheduleView).toContain('.accessibilityLabel("Next month")');
    expect(scheduleView).toContain(".listRowBackground(Color.clear)");
    expect(scheduleView).toContain("LegendAssignmentMark(label: \"My shift\")");
  });

  it("routes Event detail full-screen with adaptive actions and retry", () => {
    const eventDetail = source("ios/Wisconsin/Views/EventDetailSheet.swift");
    const eventDetailView = sliceBetween(
      eventDetail,
      "struct EventDetailView: View",
      "// MARK: - Section Header",
    );
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

    expect(eventDetail).toContain("struct EventDetailView: View");
    expect(eventDetail).not.toContain("struct EventDetailSheet: View");
    expect(eventDetail).not.toContain("Button(\"Done\")");
    expect(eventDetailView).not.toContain("@Environment(\\.dismiss)");
    expect(eventDetail).toContain("assignmentSection");
    expect(eventDetail).toContain("openShiftSection");
    // Add Shift lives in the Crew section header. The separate "Staffing" card
    // was removed: it restated the coverage the Crew pill already shows.
    expect(eventDetail).not.toContain("staffingActionSection");
    expect(eventDetail).toContain("addShiftButton");
    expect(eventDetail).toContain("Label(\"Add Shift\", systemImage: \"plus\")");
    expect(eventDetail).toContain("Button(\"Try Again\")");
    expect(eventDetail).toContain('return "Today, \\(date.formatted');
    expect(eventDetail).toContain('return "Tomorrow, \\(date.formatted');
    expect(eventDetail).toContain("myShift?.gear.bookings");
    expect(eventDetail).toContain("BookingDetailView(bookingId: gear.id)");
    expect(eventDetail).not.toContain("ToolbarItem(placement: .bottomBar)");
    expect(crewSection).toContain("EventDetailSectionHeader(title: \"Crew\", systemImage: \"person.2.fill\")");
    expect(crewSection).toContain("if canManageShifts, let coverage");
    expect(sectionHeader).toContain(".foregroundStyle(.secondary)");
    expect(sectionHeader).toContain(".accessibilityAddTraits(.isHeader)");
    expect(sectionHeader).not.toContain(".accessibilityElement(children: .combine)");
    expect(shiftRow).toContain("Text(\"You\")");
    expect(shiftRow).toContain("Color.statusBackground(.blue)");
    expect(shiftRow).not.toContain("Color.statusText(.blue).opacity(0.06)");
    expect(shiftRow).not.toContain(".frame(width: 7, height: 7)");
  });

  it("preserves Schedule state through navigation and omits current-year noise", () => {
    const scheduleView = source("ios/Wisconsin/Views/ScheduleView.swift");
    const homeView = source("ios/Wisconsin/Views/HomeView.swift");

    expect(scheduleView).toContain("NavigationStack(path: $navigationPath)");
    // The list row pushes by appending to the path rather than using a
    // NavigationLink: inside a List, NavigationLink also renders a system
    // disclosure indicator outside the card, on top of EventRow's own chevron.
    expect(scheduleView).toContain("navigationPath.append(ScheduleEventRoute(id: event.id))");
    expect(scheduleView).toContain(".navigationDestination(for: ScheduleEventRoute.self)");
    expect(scheduleView).not.toContain(".sheet(item: $selectedEvent)");
    expect(homeView).toContain("EventDetailView(event: work.asScheduleEvent");
    expect(homeView).not.toContain("EventDetailSheet(");
    expect(scheduleView).toContain("year == currentYear");
    expect(scheduleView).not.toContain("Updated \\(loadedAt.formatted");
  });
});
