import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("iOS booking surface alignment", () => {
  const bookings = readFileSync("ios/Wisconsin/Views/BookingsView.swift", "utf8");
  const itemDetail = readFileSync("ios/Wisconsin/Views/ItemDetailView.swift", "utf8");
  const bookingRow = bookings.slice(bookings.indexOf("struct BookingRow: View"));

  it("uses the same title, timing, and requester reading order as item detail", () => {
    expect(bookingRow.indexOf("bookingTitle.lineLimit(1)")).toBeLessThan(
      bookingRow.indexOf("timingLine(lineLimit: 1)"),
    );
    expect(bookingRow.indexOf("timingLine(lineLimit: 1)")).toBeLessThan(
      bookingRow.indexOf("metadataLine(lineLimit: 1)"),
    );
    expect(bookingRow).toContain("Text(booking.requester.name)");

    const activeItemCard = itemDetail.slice(
      itemDetail.indexOf("private struct ActiveBookingCard"),
      itemDetail.indexOf("// MARK: - Availability card"),
    );
    expect(activeItemCard.indexOf("Text(booking.title)")).toBeLessThan(
      activeItemCard.indexOf("TimelineView("),
    );
    expect(activeItemCard.indexOf("TimelineView(")).toBeLessThan(
      activeItemCard.indexOf("Text(booking.requesterName)"),
    );
  });

  it("lets the rail and timing color carry active checkout urgency without a duplicate badge", () => {
    // Open checkouts (blue rail + "Due") and booked rows (purple rail +
    // "Pickup") are already self-describing, so neither takes a badge.
    expect(bookingRow).toContain("case .open: booking.kind != .checkout");
    expect(bookingRow).toContain("case .booked: false");
    expect(bookingRow).toContain("if showsStatusBadge");
    expect(bookingRow).toContain("StatusRail(tone: accentTone)");
    expect(bookingRow).toContain("capitalizesRelativeDay: false");
    expect(bookingRow).not.toContain("compactMagnitude(now:");
  });

  it("keeps timing typographic instead of repeating status icons", () => {
    const timingLine = bookingRow.slice(
      bookingRow.indexOf("private func timingLine"),
      bookingRow.indexOf("private func metadataLine"),
    );
    expect(timingLine).toContain("Text(info.text)");
    expect(timingLine).not.toContain("Label {");
    expect(timingLine).not.toContain("Image(systemName:");
  });
});
