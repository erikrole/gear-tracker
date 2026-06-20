import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

describe("iOS Schedule all-day display", () => {
  it("preserves manual titles and hides call-time chrome for all-day events", () => {
    const models = source("ios/Wisconsin/Models/ScheduleModels.swift");
    const scheduleView = source("ios/Wisconsin/Views/ScheduleView.swift");
    const eventDetail = source("ios/Wisconsin/Views/EventDetailSheet.swift");

    expect(models).toContain("var displayAllDay: Bool");
    expect(models).toContain("allDay || hasLocalMidnightSpan");
    expect(models).toContain("func scheduleEventDisplayTitle(_ event: ScheduleEvent) -> String");
    expect(models).toContain("let title = cleanScheduleEventSummary(event.summary)");

    expect(scheduleView).toContain("scheduleEventDisplayTitle(event)");
    expect(scheduleView).toContain("if event.displayAllDay { return \"All day\" }");
    expect(scheduleView).toContain("return event.displayAllDay ? \"All day\" : eventTimeLabel");
    expect(scheduleView).not.toContain("return Self.cleanSummary(event.summary)");

    expect(eventDetail).toContain("if event.displayAllDay { return nil }");
    expect(eventDetail).toContain("hidesShiftTimes: event.displayAllDay");
    expect(eventDetail).toContain("if !hidesShiftTimes {\n                VStack(alignment: .trailing, spacing: 2)");
  });
});
