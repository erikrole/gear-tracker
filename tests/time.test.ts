import { describe, expect, it } from "vitest";
import { parseDateRange } from "../src/lib/time";

describe("parseDateRange", () => {
  it("parses valid range", () => {
    const result = parseDateRange("2026-02-27T12:00:00.000Z", "2026-02-27T13:00:00.000Z");
    expect(result.start.toISOString()).toBe("2026-02-27T12:00:00.000Z");
    expect(result.end.toISOString()).toBe("2026-02-27T13:00:00.000Z");
  });

  it("throws when end is before start", () => {
    expect(() => parseDateRange("2026-02-27T13:00:00.000Z", "2026-02-27T12:00:00.000Z")).toThrow(
      "endsAt must be later than startsAt"
    );
  });
});
