import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("iOS bookings empty state recovery", () => {
  const source = readFileSync("ios/Wisconsin/Views/BookingsView.swift", "utf8");

  it("keeps no-result states actionable", () => {
    expect(source).toContain('Label("Clear Search", systemImage: "xmark.circle")');
    expect(source).toContain('Label("View All Bookings", systemImage: "person.2")');
    expect(source).toContain('Label("New Reservation", systemImage: "plus")');
    expect(source).toContain("ReservationEmptyRow(canCreate: canCreate)");
    expect(source).toContain('Text("No active reservations")');
    expect(source).toContain('Button("Create", action: onCreate)');
  });

  it("uses a compact scope-aware card instead of a full-screen unavailable state", () => {
    expect(source).toContain("BookingEmptyState(");
    expect(source).toContain('case .mine: return "You\'re all clear"');
    expect(source).toContain('return vm.scope == .mine ? "checkmark.seal.fill" : "calendar.badge.plus"');
    expect(source).toContain("return vm.scope == .mine ? .green : .purple");
    expect(source).toContain("You don't have any active checkouts or reservations.");
    expect(source).toContain(".brandCard(padding: Brand.Space.xl");
    expect(source).toContain(".buttonStyle(.bordered)");
    expect(source).toContain(".tint(Color.statusText(.blue))");
    expect(source).not.toContain('Label("Show all visible bookings"');
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
    expect(source).toContain('vm.mineOnly ? "person.crop.circle.fill" : "person.crop.circle"');
    expect(source).toContain(".navigationBarTitleDisplayMode(.inline)");
    expect(source).toContain(".refreshable");
    expect(source).not.toContain("Picker(\"Booking scope\"");
    expect(source).not.toContain("case needsAttention");
    expect(source).not.toContain("BookingFreshnessFooter");
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
