import { describe, expect, it } from "vitest";
import { parsePagination } from "@/lib/http";

function params(value = "") {
  return new URLSearchParams(value);
}

describe("parsePagination", () => {
  it.each([
    ["missing values", "", { limit: 50, offset: 0 }],
    ["minimum values", "limit=1&offset=0", { limit: 1, offset: 0 }],
    ["exact maxima", "limit=200&offset=10000", { limit: 200, offset: 10_000 }],
    ["limit above maximum", "limit=201&offset=10000", { limit: 200, offset: 10_000 }],
    ["unsafe limit", "limit=999999999999999999999", { limit: 200, offset: 0 }],
    ["zero limit", "limit=0&offset=4", { limit: 50, offset: 4 }],
  ])("bounds %s", (_label, query, expected) => {
    expect(parsePagination(params(query))).toEqual(expected);
  });

  it.each([
    "offset=10001",
    "offset=999999999999999999999",
  ])("rejects offsets that cannot identify a distinct supported page: %s", (query) => {
    expect(() => parsePagination(params(query))).toThrow(
      "offset must be a whole number between 0 and 10000",
    );
  });

  it.each([
    "limit=10items&offset=2pages",
    "limit=1e2&offset=1e3",
    "limit=2.5&offset=3.5",
    "limit=-1&offset=-1",
    "limit=%20&offset=%20",
  ])("rejects partially numeric and malformed values: %s", (query) => {
    expect(parsePagination(params(query))).toEqual({ limit: 50, offset: 0 });
  });
});
