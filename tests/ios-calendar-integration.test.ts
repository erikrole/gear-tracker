import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

function slice(text: string, start: string, end: string) {
  const startIndex = text.indexOf(start);
  const endIndex = text.indexOf(end, startIndex);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return text.slice(startIndex, endIndex);
}

describe("shift subscription feed", () => {
  it("tells subscribed clients how often to refresh", () => {
    const route = source("src/app/api/shifts/ics/[token]/route.ts");

    // Apple Calendar's own default for a subscription can be as slow as once a
    // day, which is useless for a schedule where shifts get traded same-day.
    expect(route).toContain('const REFRESH_INTERVAL = "PT1H"');
    expect(route).toContain("`REFRESH-INTERVAL;VALUE=DURATION:${REFRESH_INTERVAL}`");
    // Older clients read only the X- spelling.
    expect(route).toContain("`X-PUBLISHED-TTL:${REFRESH_INTERVAL}`");
  });

  it("computes the feed window without month-overflow arithmetic", () => {
    const route = source("src/app/api/shifts/ics/[token]/route.ts");

    expect(route).toContain("const HISTORY_WINDOW_MS =");
    expect(route).toContain("const FUTURE_WINDOW_MS =");
    expect(route).toContain("new Date(now.getTime() - HISTORY_WINDOW_MS)");
    expect(route).toContain("new Date(now.getTime() + FUTURE_WINDOW_MS)");
    // `setMonth(getMonth() - 1)` on the 29th-31st overflows a short month and
    // silently shrinks the history window on exactly those days.
    expect(route).not.toContain("setMonth(windowStart.getMonth() - 1)");
    expect(route).not.toContain("setFullYear(windowEnd.getFullYear() + 1)");
  });

  it("keeps the feed private and unguessable", () => {
    const route = source("src/app/api/shifts/ics/[token]/route.ts");
    const tokenRoute = source("src/app/api/shifts/ics-token/route.ts");

    expect(route).toContain("const TOKEN_RE = /^[a-f0-9]{48}$/i");
    expect(route).toContain("checkRateLimit(`shifts:ics:token:${token}`");
    expect(route).toContain("checkRateLimit(`shifts:ics:ip:${ip}`");
    expect(route).toContain("active: true");
    // Rotation is the recovery path for a leaked feed URL.
    expect(tokenRoute).toContain('randomBytes(24).toString("hex")');
    expect(tokenRoute).toContain('action: "ics_token_rotated"');
  });
});

describe("iOS calendar integration", () => {
  it("asks only for write-only calendar access", () => {
    const exporter = source("ios/Wisconsin/Core/CalendarExport.swift");
    const projectYml = source("ios/project.yml");
    const infoPlist = source("ios/Wisconsin/Supporting/Info.plist");

    // The app never reads the user's calendar, so it must not ask to.
    expect(exporter).toContain("requestWriteOnlyAccessToEvents()");
    expect(exporter).not.toContain("requestFullAccessToEvents");

    // The usage string is required or the prompt crashes the app.
    expect(projectYml).toContain("NSCalendarsWriteOnlyAccessUsageDescription:");
    expect(infoPlist).toContain("NSCalendarsWriteOnlyAccessUsageDescription");
    // The kiosk target has no per-person calendar and must not request it.
    const kiosk = slice(projectYml, "KioskOnly/Info.plist", "settings:");
    expect(kiosk).not.toContain("NSCalendarsWriteOnlyAccessUsageDescription");
  });

  it("adds a return reminder rather than a bare event", () => {
    const exporter = source("ios/Wisconsin/Core/CalendarExport.swift");

    expect(exporter).toContain("static let reminderLead: TimeInterval = 30 * 60");
    expect(exporter).toContain("EKAlarm(relativeOffset: -reminderLead)");
    // Firing an alarm for a return that already passed is noise, not a reminder.
    expect(exporter).toContain("if endsAt.timeIntervalSinceNow > reminderLead");
    // A zero-length or inverted window would be rejected by EventKit outright.
    expect(exporter).toContain("max(endsAt, startsAt.addingTimeInterval(60))");
    // No default calendar means the save fails; say so instead of throwing raw.
    expect(exporter).toContain("No default calendar is set up on this device.");
  });

  it("offers the action only on the caller's own live booking", () => {
    const detail = source("ios/Wisconsin/Views/BookingDetailView.swift");

    const gate = slice(detail, "private var canAddToCalendar: Bool {", "private var canEditBooking");
    expect(gate).toContain("booking.requester.id == user.id");
    expect(gate).toContain("booking.status == .booked");
    expect(gate).toContain("booking.status == .open");
    expect(gate).toContain("booking.status == .pendingPickup");
    // Returned and cancelled bookings have nothing left to remind anyone about.
    expect(gate).not.toContain(".completed");
    expect(gate).not.toContain(".cancelled");
  });

  it("reports a repeat add honestly instead of silently duplicating", () => {
    const exporter = source("ios/Wisconsin/Core/CalendarExport.swift");
    const detail = source("ios/Wisconsin/Views/BookingDetailView.swift");

    // Write-only access cannot read events back, so a local record is the only
    // way to know this booking was already exported.
    expect(exporter).toContain("static func hasExported(bookingId: String) -> Bool");
    expect(detail).toContain("calendarAdded = CalendarExport.hasExported(bookingId: loaded.id)");
    expect(detail).toContain('calendarAdded ? "Added to Calendar" : "Add to Calendar"');
  });

  it("clears only the local record on sign-out, never the user's events", () => {
    const exporter = source("ios/Wisconsin/Core/CalendarExport.swift");
    const app = source("ios/Wisconsin/App/WisconsinApp.swift");

    expect(exporter).toContain("static func resetExportedRecord()");
    const signOut = slice(app, "if user == nil, oldUser != nil {", "// Push permission is now requested");
    expect(signOut).toContain("CalendarExport.resetExportedRecord()");
    // Calendar entries belong to whoever added them.
    expect(exporter).not.toContain("store.remove(");
  });
});
