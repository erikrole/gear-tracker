import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("action result copy", () => {
  it("keeps Trade Board failures on object-specific recovery copy", () => {
    const tradeBoard = source("src/components/TradeBoard.tsx");

    expect(tradeBoard).toContain("const TRADE_OUTCOME_COPY");
    expect(tradeBoard).toContain("The trade was not claimed.");
    expect(tradeBoard).toContain("The shift assignment was not changed.");
    // Premier removal: open-shift pickups are instant claims, not requests.
    expect(tradeBoard).toContain("The shift was not claimed.");
    expect(tradeBoard).toContain("Open Work did not load. Retry before acting on shift or trade coverage.");

    expect(tradeBoard).not.toContain("Failed to claim trade");
    expect(tradeBoard).not.toContain("Failed to approve trade");
    expect(tradeBoard).not.toContain("Failed to decline trade");
    expect(tradeBoard).not.toContain("Failed to cancel trade");
    expect(tradeBoard).not.toContain("Failed to claim shift");
    expect(tradeBoard).not.toContain("Network error:");
    expect(tradeBoard).not.toContain("Failed to load open work.");
  });

  it("keeps booking-list failures on consequence-aware copy", () => {
    const bookingList = source("src/components/BookingListPage.tsx");

    expect(bookingList).toContain("Could not extend the booking. Refresh and check for conflicts.");
    expect(bookingList).toContain("Could not reach the server. The booking was not extended.");
    expect(bookingList).toContain("Retry before acting on this");

    expect(bookingList).not.toContain("Extend failed");
    expect(bookingList).not.toContain("Network error");
    expect(bookingList).not.toContain("Something went wrong");
  });
});
