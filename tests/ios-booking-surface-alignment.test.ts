import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("iOS booking surface alignment", () => {
  const bookings = readFileSync("ios/Wisconsin/Views/BookingsView.swift", "utf8");
  const itemDetail = readFileSync("ios/Wisconsin/Views/ItemDetailView.swift", "utf8");
  const bookingRow = bookings.slice(
    bookings.indexOf("struct BookingRow: View"),
    bookings.indexOf("private extension Booking"),
  );

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

  it("lets the rail carry normal checkout state without hiding exceptional states", () => {
    expect(bookingRow).toContain(
      "isOverdue || booking.kind != .checkout || booking.status != .open",
    );
    expect(bookingRow).toContain("if showsStatusBadge");
    expect(bookingRow).toContain("StatusRail(tone: accentTone)");
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
