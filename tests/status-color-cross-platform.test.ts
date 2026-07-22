import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { bookingStatusBadgeVariant } from "@/lib/booking-status-display";
import { statusBadgeVariant, statusBadgeVariantEquipment } from "@/lib/status-colors";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

/**
 * Extracts a Swift `switch` that maps enum cases to `StatusTone` values, e.g.
 *
 *   case .booked: return .purple
 *   case .open:   return .blue
 *
 * Returns `{ booked: "purple", open: "blue" }`. Both `return .x` and the
 * implicit-return `case .x: .y` form are accepted, since SwiftUI code uses
 * both and the mapping is what matters, not the spelling.
 */
function swiftToneMap(swift: string, functionSignature: string): Record<string, string> {
  const start = swift.indexOf(functionSignature);
  if (start === -1) throw new Error(`Not found in Swift source: ${functionSignature}`);
  // Stop at the closing of the declaration's body: the next line that is a
  // single closing brace at the declaration's own indent level.
  const body = swift.slice(start, swift.indexOf("\n    }", start));
  const map: Record<string, string> = {};
  for (const [, swiftCase, tone] of body.matchAll(
    /case \.([a-zA-Z]+):\s*(?:return )?\.([a-zA-Z]+)/g,
  )) {
    map[swiftCase] = tone;
  }
  return map;
}

/** iOS enum case name → the status string the web helpers are keyed by. */
const BOOKING_CASE_TO_WEB_STATUS: Record<string, string> = {
  draft: "DRAFT",
  booked: "BOOKED",
  pendingPickup: "PENDING_PICKUP",
  open: "OPEN",
  completed: "COMPLETED",
  cancelled: "CANCELLED",
};

const ASSET_CASE_TO_WEB_STATUS: Record<string, string> = {
  available: "AVAILABLE",
  checkedOut: "CHECKED_OUT",
  pendingPickup: "PENDING_PICKUP",
  reserved: "RESERVED",
  maintenance: "MAINTENANCE",
  retired: "RETIRED",
};

describe("status colors agree across web and iOS", () => {
  it("maps every booking status to the same color on both platforms", () => {
    const ios = swiftToneMap(
      source("ios/Wisconsin/Views/BookingsView.swift"),
      "private var tone: StatusTone {\n        if isOverdue { return .red }",
    );

    // Guard against the extractor silently matching nothing.
    expect(Object.keys(ios).length).toBeGreaterThanOrEqual(6);

    for (const [swiftCase, webStatus] of Object.entries(BOOKING_CASE_TO_WEB_STATUS)) {
      expect(ios[swiftCase], `iOS StatusBadge is missing ${swiftCase}`).toBeDefined();
      expect(
        ios[swiftCase],
        `${webStatus}: iOS says ${ios[swiftCase]}, web says ${bookingStatusBadgeVariant(webStatus)}`,
      ).toBe(bookingStatusBadgeVariant(webStatus));
    }
  });

  it("maps every asset status to the same color on both platforms", () => {
    const ios = swiftToneMap(
      source("ios/Wisconsin/Views/ItemsView.swift"),
      "func assetStatusTone(_ asset: Asset) -> StatusTone {",
    );

    expect(Object.keys(ios).length).toBeGreaterThanOrEqual(6);

    for (const [swiftCase, webStatus] of Object.entries(ASSET_CASE_TO_WEB_STATUS)) {
      expect(ios[swiftCase], `iOS assetStatusTone is missing ${swiftCase}`).toBeDefined();
      expect(
        ios[swiftCase],
        `${webStatus}: iOS says ${ios[swiftCase]}, web says ${statusBadgeVariantEquipment(webStatus)}`,
      ).toBe(statusBadgeVariantEquipment(webStatus));
    }
  });

  it("keeps the no-kind search/scan mapping on the canonical booking colors", () => {
    // BOOKED is claimed work, not active custody. This mapping returned blue
    // for years on the theory that kind was unavailable, but kind never
    // changed BOOKED's color -- it is purple for checkouts and reservations
    // alike, so there was nothing for the missing kind to disambiguate.
    expect(statusBadgeVariant("BOOKED")).toBe("purple");
    expect(statusBadgeVariant("BOOKED")).toBe(bookingStatusBadgeVariant("BOOKED"));
    expect(statusBadgeVariant("OPEN")).toBe(bookingStatusBadgeVariant("OPEN"));
    expect(statusBadgeVariant("PENDING_PICKUP")).toBe(bookingStatusBadgeVariant("PENDING_PICKUP"));
    expect(statusBadgeVariant("DRAFT")).toBe(bookingStatusBadgeVariant("DRAFT"));
    expect(statusBadgeVariant("COMPLETED")).toBe(bookingStatusBadgeVariant("COMPLETED"));
    expect(statusBadgeVariant("CANCELLED")).toBe(bookingStatusBadgeVariant("CANCELLED"));
  });

  it("never colors an active checkout green", () => {
    // Semantic rule #1: green means the gear is free. Every "in custody"
    // status must therefore be anything but green, on both platforms.
    for (const status of ["OPEN", "CHECKED_OUT"]) {
      expect(statusBadgeVariant(status)).not.toBe("green");
    }
    expect(statusBadgeVariantEquipment("CHECKED_OUT")).not.toBe("green");
    expect(bookingStatusBadgeVariant("OPEN")).not.toBe("green");

    const bookingsView = source("ios/Wisconsin/Views/BookingsView.swift");
    expect(bookingsView).not.toContain("case .open: return .green");
  });
});
