import { describe, expect, it } from "vitest";
import {
  checkoutEscalationChannels,
  checkoutEscalationDedupeKey,
  checkoutEscalationTriggerAt,
  highestEligibleCheckoutEscalationRule,
  normalizeCheckoutEscalationConfig,
} from "@/lib/checkout-escalation-policy";

const dueAt = new Date("2026-08-10T20:00:00.000Z");
const rules = [
  { type: "checkout_due_2h", hoursFromDue: -2, enabled: true, sortOrder: 0 },
  { type: "checkout_due_now", hoursFromDue: 0, enabled: true, sortOrder: 1 },
  { type: "checkout_overdue_grace", hoursFromDue: 0, enabled: true, sortOrder: 2 },
  { type: "checkout_overdue_4h", hoursFromDue: 4, enabled: true, sortOrder: 3 },
  { type: "checkout_overdue_24h", hoursFromDue: 24, enabled: true, sortOrder: 4 },
];

describe("checkout escalation policy", () => {
  it("uses grace only for the first overdue boundary", () => {
    expect(checkoutEscalationTriggerAt(rules[1]!, dueAt, 0.5).toISOString())
      .toBe("2026-08-10T20:00:00.000Z");
    expect(checkoutEscalationTriggerAt(rules[2]!, dueAt, 0.5).toISOString())
      .toBe("2026-08-10T20:30:00.000Z");
    expect(checkoutEscalationTriggerAt(rules[3]!, dueAt, 0.5).toISOString())
      .toBe("2026-08-11T00:00:00.000Z");
  });

  it("collapses a late run to the highest eligible stage", () => {
    expect(highestEligibleCheckoutEscalationRule(
      rules,
      dueAt,
      0.5,
      new Date("2026-08-11T05:00:00.000Z"),
    )?.type).toBe("checkout_overdue_4h");
  });

  it("versions dedupe keys by due date and recipient", () => {
    const original = checkoutEscalationDedupeKey({
      bookingId: "booking-1",
      dueAt,
      type: "checkout_due_now",
      recipientKind: "requester",
      recipientId: "user-1",
    });
    const extended = checkoutEscalationDedupeKey({
      bookingId: "booking-1",
      dueAt: new Date("2026-08-11T20:00:00.000Z"),
      type: "checkout_due_now",
      recipientKind: "requester",
      recipientId: "user-1",
    });
    expect(extended).not.toBe(original);
  });

  it("keeps early requester stages push-only and admin escalation email-only", () => {
    expect(checkoutEscalationChannels("checkout_due_2h", "requester"))
      .toEqual({ push: true, email: false });
    expect(checkoutEscalationChannels("checkout_overdue_24h", "admin"))
      .toEqual({ push: false, email: true });
    expect(checkoutEscalationChannels("checkout_overdue_24h", "responder"))
      .toEqual({ push: true, email: false });
  });

  it("migrates the old shared cap into the operational fallback", () => {
    expect(normalizeCheckoutEscalationConfig({ maxNotificationsPerBooking: 12 }))
      .toEqual({
        maxRequesterNotificationsPerDueDate: 5,
        maxOperationalNotificationsPerDueDate: 12,
      });
  });
});
