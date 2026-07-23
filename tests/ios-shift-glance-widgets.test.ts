import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

describe("iOS Shift Glance widgets", () => {
  it("shares only a cached personal shift snapshot through an App Group", () => {
    const project = source("ios/project.yml");
    const snapshot = source("ios/Wisconsin/Shared/ShiftGlanceSnapshot.swift");
    const coordinator = source("ios/Wisconsin/Core/ShiftGlanceSnapshotCoordinator.swift");

    expect(project.match(/group\.com\.erikrole\.Wisconsin/g)).toHaveLength(2);
    expect(project).toContain("Wisconsin/Shared/ShiftGlanceSnapshot.swift");
    expect(snapshot).toContain('static let storageKey = "ShiftGlanceSnapshot.v1"');
    expect(snapshot).toContain("static let maximumAge: TimeInterval = 12 * 60 * 60");
    expect(coordinator).toContain("APIClient.shared.myShifts(limit: 10)");
    expect(coordinator).toContain("WidgetCenter.shared.reloadTimelines");
    expect(snapshot).not.toContain("requester");
    expect(snapshot).not.toContain("coverage");
    expect(snapshot).not.toContain("trade");
  });

  it("refreshes from the app lifecycle and clears cached shift data on sign-out", () => {
    const appState = source("ios/Wisconsin/Core/AppState.swift");
    const app = source("ios/Wisconsin/App/WisconsinApp.swift");

    expect(appState).toContain("ShiftGlanceSnapshotCoordinator.shared.refresh()");
    expect(app).toContain("ShiftGlanceSnapshotCoordinator.shared.clear()");
  });

  it("ships small, medium, and Lock Screen widgets without live API access", () => {
    const bundle = source("ios/WisconsinLiveActivities/CheckoutReturnLiveActivityWidget.swift");
    const widget = source("ios/WisconsinLiveActivities/ShiftGlanceWidget.swift");

    expect(bundle).toContain("ShiftGlanceWidget()");
    expect(widget).toContain("struct ShiftGlanceWidget: Widget");
    expect(widget).toContain(".systemSmall");
    expect(widget).toContain(".systemMedium");
    expect(widget).toContain(".accessoryInline");
    expect(widget).toContain(".accessoryRectangular");
    expect(widget).toContain(".containerBackground(.fill.tertiary, for: .widget)");
    expect(widget).toContain('URL(string: "wisconsin://event/');
    expect(widget).toContain('URL(string: "wisconsin://schedule")');
    expect(widget).not.toContain("APIClient");
    expect(widget).not.toContain("URLSession");
  });

  it("routes widget taps through the existing native Schedule handoff", () => {
    const app = source("ios/Wisconsin/App/WisconsinApp.swift");

    expect(app).toContain('case "event":');
    expect(app).toContain("appState.pendingPushEventId = eventId");
    expect(app).toContain('case "schedule":');
    expect(app).toContain("appState.pendingAppIntentDestination = .todaySchedule");
  });
});
