import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

describe("iOS AppState refresh energy budget", () => {
  it("throttles non-critical foreground badge refreshes", () => {
    const appState = source("ios/Wisconsin/Core/AppState.swift");

    expect(appState).toContain("private var lastRefreshAttemptAt: Date?");
    expect(appState).toContain("private let minimumRefreshInterval: TimeInterval = 60");
    expect(appState).toContain("func refresh(forceRefresh: Bool = false) async");
    expect(appState).toContain("Date().timeIntervalSince(lastRefreshAttemptAt) < minimumRefreshInterval");
    expect(appState).toContain("lastRefreshAttemptAt = Date()");
  });

  it("keeps lifecycle refresh opportunistic but forces user-driven badge updates", () => {
    const app = source("ios/Wisconsin/App/WisconsinApp.swift");
    const home = source("ios/Wisconsin/Views/HomeView.swift");
    const schedule = source("ios/Wisconsin/Views/ScheduleView.swift");

    expect(app).toContain("Task { await appState.refresh() }");
    expect(home).toContain("Task { await appState.refresh(forceRefresh: true) }");
    expect(schedule).toContain("Task { await appState.refresh(forceRefresh: true) }");
  });
});
