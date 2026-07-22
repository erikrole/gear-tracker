import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

describe("iOS Home header source contract", () => {
  it("keeps the Home hero free of generated summary copy", () => {
    const home = source("ios/Wisconsin/Views/HomeView.swift");

    expect(home).not.toContain("import FoundationModels");
    expect(home).not.toContain("homeGeneratedHeaderDefaultsKey");
    expect(home).not.toContain("SystemLanguageModel");
    expect(home).not.toContain("LanguageModelSession");
    expect(home).not.toContain("GenerationOptions");
    expect(home).not.toContain("HomeHeaderSignal");
    expect(home).not.toContain("generatedMessage");
    expect(home).not.toContain("headerMessage");
    expect(home).not.toContain("fallbackMessage");
  });

  it("varies the greeting locally while leaving operational rows authoritative", () => {
    const home = source("ios/Wisconsin/Views/HomeView.swift");

    expect(home).toContain("private var greeting: String");
    expect(home).toContain("let dayOrdinal = calendar.ordinality(of: .day, in: .era, for: .now)");
    expect(home).toContain('variants = ["Good morning", "Morning", "Good to see you"]');
    expect(home).toContain('variants = ["Good afternoon", "Afternoon", "Good to see you"]');
    expect(home).toContain('variants = ["Good evening", "Evening", "Welcome back"]');
    expect(home).toContain('variants = ["Hello", "Welcome back", "Good to see you"]');
    expect(home).toContain("return variants[dayOrdinal % variants.count]");
    expect(home).toContain("HomeActionQueue(");
  });

  it("keeps Live Activity reconciliation out of the Home dashboard load timing", () => {
    const home = source("ios/Wisconsin/Views/HomeView.swift");
    const loadBody = home.slice(
      home.indexOf("func load(appState: AppState?"),
      home.indexOf("private static func reconcileCheckoutReturnLiveActivity"),
    );

    expect(loadBody).toContain("launch.home.dashboardLoad result=success");
    expect(loadBody).toContain("Task { await Self.reconcileCheckoutReturnLiveActivity");
    expect(loadBody).not.toContain("await CheckoutReturnLiveActivityManager.shared.reconcileCurrentUserCheckouts");
    expect(home).toContain("launch.home.liveActivityReconcile");
  });

  it("keeps Home focused on the action queue without a floating create button", () => {
    const home = source("ios/Wisconsin/Views/HomeView.swift");

    expect(home).not.toContain("@State private var showCreate");
    expect(home).not.toContain(".overlay(alignment: .bottomTrailing)");
    expect(home).not.toContain("CreateBookingSheet { newId in");
    expect(home).not.toContain("#if DEBUG");
    expect(home).not.toContain("KioskStore.enterKiosk");
    expect(home).toContain("HomeActionQueue(");
    expect(home).toContain("AllClearEmptyState(openSearch: { appState.presentSearch() })");
    expect(home).toContain('Text("Use Search to look up gear or scan a code.")');
    expect(home).toContain('Label("Search or Scan", systemImage: "magnifyingglass")');
  });

  it("shows only actionable metrics as compact disclosure rows", () => {
    const home = source("ios/Wisconsin/Views/HomeView.swift");
    const brand = source("ios/Wisconsin/Core/Brand.swift");

    expect(home).toContain("private var activeItems: [StatItem]");
    expect(home).toContain("if stats.dueToday > 0");
    expect(home).toContain('StatItem(id: "due-today"');
    expect(home).toContain("private struct StatRow: View");
    expect(home).toContain("tone: .orange");
    expect(home).toContain("Color.statusIconBackground(item.tone)");
    expect(home).toContain("Color.cardSurface");
    expect(home).toContain('Image(systemName: "chevron.right")');
    expect(home).not.toContain("private struct StatCard");
    expect(home).toContain(".foregroundStyle(.secondary)");
    expect(brand).toContain("// #d97706");
    expect(brand).toContain("// #fff7ed");
    expect(brand).toContain("// #ffedd5");
  });

  it("keeps all-day event work rows date-only on Home", () => {
    const home = source("ios/Wisconsin/Views/HomeView.swift");

    expect(home).toContain("private var scheduleEvent: ScheduleEvent { work.asScheduleEvent }");
    expect(home).toContain("private var isAllDayEvent: Bool { scheduleEvent.displayAllDay }");
    expect(home).toContain("private var timeMeta: String");
    expect(home).toContain("scheduleEvent.spannedDays");
    expect(home).toContain('return "\\(day), All day"');
    // An all-day row has no call time to state, so the line drops out entirely
    // and the "All day" meta is what the accessibility label reads back.
    expect(home).toContain("private var callTimeLine: String?");
    expect(home).toContain("guard !isAllDayEvent else { return nil }");
    expect(home).toContain("parts.append(timeMeta)");
    expect(home).toContain('return "Pickup gear for event"');
    expect(home).not.toContain("Text(firstTime.formatted(.dateTime.weekday(.abbreviated).hour().minute()))");
  });

  it("keeps Next Up rows informational, with kind glyphs instead of action chips", () => {
    const home = source("ios/Wisconsin/Views/HomeView.swift");

    // Next Up states what is coming; the work itself happens in the detail
    // sheet these rows open, so no row carries an action verb.
    expect(home).not.toContain("primaryLabel");
    expect(home).not.toContain('"Reserve gear"');
    expect(home).not.toContain('"Open checkout"');
    expect(home).not.toContain('"Review overdue"');
    expect(home).not.toContain("Gear needed");
    // Gear rows and shift rows sit interleaved, so each names its kind with
    // the same glyph the stat strip uses, and rows are divided.
    expect(home).toContain("private struct QueueKindGlyph: View");
    expect(home).toContain('case .eventWork: "calendar"');
    expect(home).toContain('default: "shippingbox.fill"');
    expect(home).toContain("private struct QueueDisclosureChevron: View");
    expect(home).toContain("Divider().padding(.leading, 46)");
    // The bullet only separates two detail lines; a lone line goes without.
    expect(home).toContain("showsBullet: detailLines.count > 1");
  });

  it("colors Next Up rows from the domain each row belongs to", () => {
    const home = source("ios/Wisconsin/Views/HomeView.swift");

    // Gear rows read the booking-status palette in docs/COLOR_SYSTEM.md, with
    // the sanctioned deadline overlay on an open checkout due today.
    expect(home).toContain("private func queueGearTone(for summary: BookingSummary) -> StatusTone");
    expect(home).toContain("if summary.isOverdue { return .red }");
    expect(home).toContain("case .booked: return .purple");
    expect(home).toContain("case .pendingPickup: return .orange");
    expect(home).toContain(
      "case .open: return Calendar.current.isDateInToday(summary.endsAt) ? .orange : .blue",
    );
    // Shift rows read the scheduling domain's location palette instead, the
    // same mapping the Schedule tab's rails use.
    expect(home).toContain("private func queueVenueTone(for event: DashboardEventWorkEvent) -> StatusTone");
    expect(home).toContain("private var tone: StatusTone { queueVenueTone(for: work.event) }");
    // Gear readiness must not drive an event row's color: green there would
    // mean "home game" on Schedule and "gear booked" on Home.
    expect(home).not.toContain("work.needsGear ? .blue : .green");
    // No queue row invents a tone outside the two mappings.
    expect(home).not.toContain("summary.startsAt < Date() ? .orange : .green");
  });
});
