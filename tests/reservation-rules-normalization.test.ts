import { describe, expect, it } from "vitest";
import {
  DEFAULT_RESERVATION_RULES,
  normalizeReservationRules,
} from "@/lib/services/reservation-rules";

describe("normalizeReservationRules", () => {
  it.each([
    ["minimum", 1, 1],
    ["maximum", 730, 730],
    ["rounds up to the minimum", 0.5, 1],
    ["rounds down within the maximum", 730.49, 730],
    ["rounds below the minimum", 0.49, null],
    ["rounds above the maximum", 730.5, null],
    ["positive infinity", Number.POSITIVE_INFINITY, null],
    ["negative infinity", Number.NEGATIVE_INFINITY, null],
    ["NaN", Number.NaN, null],
    ["wrong type", "30", null],
  ])("BUG: bounds advanceWindowDays for %s", (_label, raw, expected) => {
    expect(normalizeReservationRules({ advanceWindowDays: raw }).advanceWindowDays).toBe(expected);
  });

  it.each([
    ["minimum", 1, 1],
    ["maximum", 336, 336],
    ["in-range decimal", 12.5, 12.5],
    ["below minimum", 0.999, DEFAULT_RESERVATION_RULES.noShowExpiryHours],
    ["above maximum", 336.001, DEFAULT_RESERVATION_RULES.noShowExpiryHours],
    ["positive infinity", Number.POSITIVE_INFINITY, DEFAULT_RESERVATION_RULES.noShowExpiryHours],
    ["negative infinity", Number.NEGATIVE_INFINITY, DEFAULT_RESERVATION_RULES.noShowExpiryHours],
    ["NaN", Number.NaN, DEFAULT_RESERVATION_RULES.noShowExpiryHours],
    ["wrong type", "48", DEFAULT_RESERVATION_RULES.noShowExpiryHours],
  ])("BUG: bounds noShowExpiryHours for %s", (_label, raw, expected) => {
    expect(normalizeReservationRules({ noShowExpiryHours: raw }).noShowExpiryHours).toBe(expected);
  });

  it.each([
    ["minimum", 1, 1],
    ["maximum", 50, 50],
    ["rounds up to the minimum", 0.5, 1],
    ["rounds down within the maximum", 50.49, 50],
    ["rounds below the minimum", 0.49, null],
    ["rounds above the maximum", 50.5, null],
    ["positive infinity", Number.POSITIVE_INFINITY, null],
    ["negative infinity", Number.NEGATIVE_INFINITY, null],
    ["NaN", Number.NaN, null],
    ["wrong type", "5", null],
  ])("BUG: bounds maxConcurrentReservations for %s", (_label, raw, expected) => {
    expect(normalizeReservationRules({ maxConcurrentReservations: raw }).maxConcurrentReservations).toBe(expected);
  });
});
