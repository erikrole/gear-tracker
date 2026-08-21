import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  "src/components/booking-details/EditBookingEventsDialog.tsx",
  "utf8",
);

describe("linked-event picker window", () => {
  it("requests active and upcoming events while retaining existing links", () => {
    expect(source).toContain("const now = new Date();");
    expect(source).toContain("startDate: now.toISOString(),");
    expect(source).toContain('includePast: "false"');
    expect(source).toContain("setEvents(mergeEvents(json?.data ?? [], existingEvents));");
    expect(source).toContain("setEvents(existingEvents);");
    expect(source).not.toContain("Date.now() - 7 * 24 * 60 * 60 * 1000");
    expect(source).not.toContain('includePast: "true"');
  });
});
