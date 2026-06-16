import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

describe("iOS kiosk all-day event contract", () => {
  it("keeps all-day kiosk events date-only and call-time free", () => {
    const route = source("src/app/api/kiosk/dashboard/route.ts");
    const models = source("ios/Wisconsin/Kiosk/KioskModels.swift");
    const idle = source("ios/Wisconsin/Kiosk/KioskIdleView.swift");

    expect(route).toContain("allDay: true");
    expect(route).toContain("allDay: e.allDay");
    expect(models).toContain("let allDay: Bool");
    expect(models).toContain("decodeIfPresent(Bool.self, forKey: .allDay) ?? false");
    expect(idle).toContain("if event.allDay {\n            return \"All day\"");
    expect(idle).toContain("if !event.allDay {\n                        KioskEventTimeRow(label: \"Call\", value: callTimeLabel)");
    expect(idle).toContain("if eventAllDay {\n            return area");
  });
});
