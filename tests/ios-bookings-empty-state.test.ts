import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("iOS bookings empty state recovery", () => {
  const source = readFileSync("ios/Wisconsin/Views/BookingsView.swift", "utf8");

  it("keeps no-result states actionable", () => {
    expect(source).toContain('Label("Clear search", systemImage: "xmark.circle")');
    expect(source).toContain('Label("Show all visible bookings", systemImage: "person.2")');
    expect(source).toContain('Label("New Reservation", systemImage: "plus")');
  });

  it("reloads the booking list after recovery actions", () => {
    expect(source).toContain("vm.searchText = \"\"");
    expect(source).toContain("vm.scope = .all");
    expect(source.match(/Task \{ await vm\.load\(reset: true, clearExistingRows: true\) \}/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("renders one grouped chronological list instead of separated top tabs", () => {
    expect(source).toContain("var sortedCheckouts: [Booking]");
    expect(source).toContain("var sortedReservations: [Booking]");
    expect(source).toContain("lhs.startsAt > rhs.startsAt");
    expect(source).toContain('BookingListSection(title: "Checkouts"');
    expect(source).toContain('BookingListSection(title: "Reservations"');
    expect(source).toContain('"Search bookings..."');
    expect(source).toContain("Picker(\"Booking scope\"");
    expect(source).toContain("case needsAttention");
    expect(source).not.toContain("Picker(\"Booking type\"");
    expect(source).not.toContain("enum BookingTab");
  });

  it("uses requester avatar photos and operational status labels", () => {
    expect(source).toContain("UserAvatarView(name: booking.requester.name, avatarUrl: booking.requester.avatarUrl");
    expect(source).toContain('if isOverdue { return "Overdue" }');
    expect(source).toContain('if status == .booked { return "Reserved" }');
    expect(source).toContain('if status == .open { return "Checked Out" }');
  });
});
