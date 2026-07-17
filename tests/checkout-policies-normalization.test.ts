import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import {
  DEFAULT_CHECKOUT_POLICIES,
  normalizeCheckoutPolicies,
} from "@/lib/services/checkout-policies";

const validPolicies = {
  defaultLoanDays: 14,
  gracePeriodHours: 12.5,
  maxItemsPerUser: 25,
};

describe("normalizeCheckoutPolicies", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a string", "corrupt"],
    ["an array", []],
  ])("uses defaults for malformed top-level value %s", (_label, raw) => {
    expect(normalizeCheckoutPolicies(raw)).toEqual(DEFAULT_CHECKOUT_POLICIES);
  });

  it("defaults malformed object properties independently", () => {
    expect(normalizeCheckoutPolicies({
      defaultLoanDays: "14",
      gracePeriodHours: {},
      maxItemsPerUser: false,
    })).toEqual(DEFAULT_CHECKOUT_POLICIES);
  });

  it.each([
    ["defaultLoanDays", 1],
    ["defaultLoanDays", 365],
    ["gracePeriodHours", 0],
    ["gracePeriodHours", 168],
    ["maxItemsPerUser", 1],
    ["maxItemsPerUser", 100],
  ] as const)("preserves exact %s boundary %s", (field, value) => {
    expect(normalizeCheckoutPolicies({ ...validPolicies, [field]: value })[field]).toBe(value);
  });

  it.each([
    ["defaultLoanDays", 0, DEFAULT_CHECKOUT_POLICIES.defaultLoanDays],
    ["gracePeriodHours", -Number.EPSILON, DEFAULT_CHECKOUT_POLICIES.gracePeriodHours],
    ["maxItemsPerUser", 0, null],
  ] as const)("falls back when %s is just below its minimum at %s", (field, value, expected) => {
    expect(normalizeCheckoutPolicies({ ...validPolicies, [field]: value })[field]).toBe(expected);
  });

  it.each([
    ["defaultLoanDays", 366, DEFAULT_CHECKOUT_POLICIES.defaultLoanDays],
    ["gracePeriodHours", 168.00000000000003, DEFAULT_CHECKOUT_POLICIES.gracePeriodHours],
    ["maxItemsPerUser", 101, null],
  ] as const)("BUG: rejects %s just above its maximum at %s", (field, value, expected) => {
    expect(normalizeCheckoutPolicies({ ...validPolicies, [field]: value })[field]).toBe(expected);
  });

  it.each([
    ["defaultLoanDays", Number.NaN, DEFAULT_CHECKOUT_POLICIES.defaultLoanDays],
    ["defaultLoanDays", Number.NEGATIVE_INFINITY, DEFAULT_CHECKOUT_POLICIES.defaultLoanDays],
    ["gracePeriodHours", Number.NaN, DEFAULT_CHECKOUT_POLICIES.gracePeriodHours],
    ["gracePeriodHours", Number.NEGATIVE_INFINITY, DEFAULT_CHECKOUT_POLICIES.gracePeriodHours],
    ["maxItemsPerUser", Number.NaN, null],
    ["maxItemsPerUser", Number.NEGATIVE_INFINITY, null],
  ] as const)("falls back for already-safe non-finite %s value %s", (field, value, expected) => {
    expect(normalizeCheckoutPolicies({ ...validPolicies, [field]: value })[field]).toBe(expected);
  });

  it.each([
    ["defaultLoanDays", DEFAULT_CHECKOUT_POLICIES.defaultLoanDays],
    ["gracePeriodHours", DEFAULT_CHECKOUT_POLICIES.gracePeriodHours],
    ["maxItemsPerUser", null],
  ] as const)("BUG: rejects positive Infinity for %s", (field, expected) => {
    const value = Number.POSITIVE_INFINITY;
    expect(normalizeCheckoutPolicies({ ...validPolicies, [field]: value })[field]).toBe(expected);
  });

  it.each([
    ["defaultLoanDays", 1.4, 1],
    ["defaultLoanDays", 364.6, 365],
    ["maxItemsPerUser", 1.4, 1],
    ["maxItemsPerUser", 99.6, 100],
  ] as const)("preserves tolerant rounding for bounded %s value %s", (field, value, expected) => {
    expect(normalizeCheckoutPolicies({ ...validPolicies, [field]: value })[field]).toBe(expected);
  });

  it.each([
    ["defaultLoanDays", 0.1, DEFAULT_CHECKOUT_POLICIES.defaultLoanDays],
    ["defaultLoanDays", 365.6, DEFAULT_CHECKOUT_POLICIES.defaultLoanDays],
    ["maxItemsPerUser", 0.1, null],
    ["maxItemsPerUser", 100.6, null],
  ] as const)("BUG: rejects rounded %s value %s outside its range", (field, value, expected) => {
    expect(normalizeCheckoutPolicies({ ...validPolicies, [field]: value })[field]).toBe(expected);
  });

  it("preserves bounded fractional grace hours", () => {
    expect(normalizeCheckoutPolicies(validPolicies).gracePeriodHours).toBe(12.5);
  });

  it("preserves null as no per-user checkout limit", () => {
    expect(normalizeCheckoutPolicies({ ...validPolicies, maxItemsPerUser: null }).maxItemsPerUser).toBeNull();
  });
});
