import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

describe("iOS Home AFM header source contract", () => {
  it("uses on-device Foundation Models only for a bounded optional header line", () => {
    const home = source("ios/Wisconsin/Views/HomeView.swift");

    expect(home).toContain("import FoundationModels");
    expect(home).toContain('private let homeGeneratedHeaderDefaultsKey = "WisconsinHomeGeneratedHeaderEnabled"');
    expect(home).toContain("UserDefaults.standard.bool(forKey: homeGeneratedHeaderDefaultsKey)");
    expect(home).toContain("Task.sleep(for: .milliseconds(1_500))");
    expect(home).toContain("SystemLanguageModel.default.availability == .available");
    expect(home).toContain("LanguageModelSession(instructions:");
    expect(home).toContain("maximumResponseTokens: 28");
    expect(home).toContain("generatedMessage ?? signal.fallbackMessage");
    expect(home).toContain("validatedGeneratedMessage");
  });

  it("keeps the model prompt count-only and leaves operational rows authoritative", () => {
    const home = source("ios/Wisconsin/Views/HomeView.swift");

    expect(home).toContain("Do not invent tasks, names, games, locations, or counts.");
    expect(home).toContain("- Overdue checkouts: \\(signal.overdueCount)");
    expect(home).toContain("- Pending pickups: \\(signal.pendingPickupCount)");
    expect(home).not.toContain("Booking title:");
    expect(home).not.toContain("summary.title)");
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
    expect(home).toContain("HomeActionQueue(");
    expect(home).toContain("AllClearEmptyState(openScan: { appState.presentScanLookup() })");
  });

  it("uses a stronger due-today icon tile while preserving the orange text tone", () => {
    const home = source("ios/Wisconsin/Views/HomeView.swift");
    const brand = source("ios/Wisconsin/Core/Brand.swift");

    expect(home).toContain('StatCard(value: stats.dueToday, label: "Due Today"');
    expect(home).toContain("tone: .orange");
    expect(home).toContain("Color.statusIconBackground(tone)");
    expect(home).toContain(".foregroundStyle(.secondary)");
    expect(brand).toContain("// #d97706");
    expect(brand).toContain("// #fff7ed");
    expect(brand).toContain("// #ffedd5");
  });
});
