import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

/**
 * The booking list routes default to `startsAt desc`. iOS re-sorts each page
 * by due date, which looks correct under one page of rows and silently buries
 * the most urgent booking on the last page past that. These lock the client to
 * an explicit server sort, and lock that sort key to one the server accepts.
 */
describe("iOS booking list sort contract", () => {
  const client = source("ios/Wisconsin/Core/APIClient.swift");
  const queries = source("src/lib/services/bookings-queries.ts");

  it("sends an explicit sort on booking list requests", () => {
    expect(client).toContain('items.append(.init(name: "sort", value: sort))');
  });

  it("asks for soonest-due checkouts and soonest-starting reservations", () => {
    const checkouts = client.slice(
      client.indexOf("func checkouts("),
      client.indexOf("private func bookingListRequest(")
    );
    expect(checkouts).toContain('sort: String? = "endsAt"');

    const reservations = client.slice(
      client.indexOf("func reservations("),
      client.indexOf("func checkouts(")
    );
    expect(reservations).toContain('sort: String? = "oldest"');
  });

  it("uses sort keys the server actually maps", () => {
    const map = queries.slice(
      queries.indexOf("export const BOOKING_SORT_MAP"),
      queries.indexOf("function parseSearchDate")
    );
    // An unmapped key falls through to the `startsAt desc` default silently,
    // which is the exact failure this contract exists to catch.
    expect(map).toContain('endsAt: [{ endsAt: "asc" }, { id: "asc" }]');
    expect(map).toContain('oldest: [{ startsAt: "asc" }, { id: "asc" }]');
    expect(queries).toContain('const sortParam = searchParams.get("sort");');
  });

  it("keeps the client-side sort mirroring the requested server order", () => {
    const bookings = source("ios/Wisconsin/Views/BookingsView.swift");
    expect(bookings).toContain("if lhs.endsAt != rhs.endsAt { return lhs.endsAt < rhs.endsAt }");
    expect(bookings).toContain("if lhs.startsAt != rhs.startsAt { return lhs.startsAt < rhs.startsAt }");
  });
});
