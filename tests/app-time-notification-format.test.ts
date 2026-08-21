import { describe, expect, it } from "vitest";

import { formatAppDateTime, formatAppTime, formatAppWindow } from "@/lib/app-time";

// 2026-10-17T21:30:00Z is 4:30 PM Central on a Saturday. The old formatter
// carried no timezone, so on the server it rendered this as 9:30 PM -- five
// hours after the call it was describing.
const CALL = "2026-10-17T21:30:00.000Z";
const CALL_END = "2026-10-18T02:00:00.000Z";

describe("notification time formatting", () => {
  it("renders a call time in Central, not the server's zone", () => {
    expect(formatAppDateTime(CALL, "America/Chicago")).toBe("Sat, Oct 17, 4:30 PM");
  });

  it("formats a window as a date plus a closing clock time", () => {
    expect(formatAppWindow(CALL, CALL_END, "America/Chicago"))
      .toBe("Sat, Oct 17, 4:30 PM - 9:00 PM");
  });

  it("collapses a zero-length window to one time", () => {
    expect(formatAppWindow(CALL, CALL, "America/Chicago")).toBe("Sat, Oct 17, 4:30 PM");
  });

  it("falls back to the start when there is no end", () => {
    expect(formatAppWindow(CALL, null, "America/Chicago")).toBe("Sat, Oct 17, 4:30 PM");
  });

  it("formats a bare clock time", () => {
    expect(formatAppTime(CALL, "America/Chicago")).toBe("4:30 PM");
  });

  it("honours a different zone", () => {
    expect(formatAppDateTime(CALL, "UTC")).toBe("Sat, Oct 17, 9:30 PM");
  });

  it("accepts a Date as readily as an ISO string", () => {
    expect(formatAppDateTime(new Date(CALL), "America/Chicago")).toBe("Sat, Oct 17, 4:30 PM");
  });
});
