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
    expect(home).toContain("if !isAllDayEvent {");
    expect(home).toContain('parts.append("All day event")');
    expect(home).toContain('return "Pickup gear for event"');
    expect(home).not.toContain("Text(firstTime.formatted(.dateTime.weekday(.abbreviated).hour().minute()))");
  });
});
