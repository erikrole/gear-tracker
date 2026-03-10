import { describe, it, expect } from "vitest";
import { canPerformAction, getAllowedActions, type CheckoutAction } from "@/lib/services/booking-rules";

const admin = { id: "admin-1", role: "ADMIN" as const };
const staff = { id: "staff-1", role: "STAFF" as const };
const owner = { id: "student-1", role: "STUDENT" as const };
const otherStudent = { id: "student-2", role: "STUDENT" as const };

function makeCheckout(status: string, requesterId = "student-1", createdById = "staff-1") {
  return {
    kind: "CHECKOUT" as const,
    status: status as any,
    requesterUserId: requesterId,
    createdBy: createdById,
  };
}

describe("canPerformAction", () => {
  // ── Non-checkout rejection ──
  it("rejects actions on reservations", () => {
    const reservation = { kind: "RESERVATION" as const, status: "BOOKED" as any, requesterUserId: "u1", createdBy: "u1" };
    expect(canPerformAction(admin, reservation, "edit").allowed).toBe(false);
  });

  // ── Terminal states (COMPLETED, CANCELLED) ──
  describe("terminal states", () => {
    for (const status of ["COMPLETED", "CANCELLED"]) {
      for (const action of ["edit", "extend", "cancel", "checkin", "open"] as CheckoutAction[]) {
        it(`rejects ${action} on ${status} checkout`, () => {
          const result = canPerformAction(admin, makeCheckout(status), action);
          expect(result.allowed).toBe(false);
          expect(result.reason).toContain(status);
        });
      }
    }
  });

  // ── BOOKED state ──
  describe("BOOKED state", () => {
    const booking = makeCheckout("BOOKED");

    it("allows admin to edit", () => {
      expect(canPerformAction(admin, booking, "edit").allowed).toBe(true);
    });

    it("allows staff to edit", () => {
      expect(canPerformAction(staff, booking, "edit").allowed).toBe(true);
    });

    it("allows owner (requester) to edit", () => {
      expect(canPerformAction(owner, booking, "edit").allowed).toBe(true);
    });

    it("denies non-owner student from editing", () => {
      expect(canPerformAction(otherStudent, booking, "edit").allowed).toBe(false);
    });

    it("allows admin to cancel", () => {
      expect(canPerformAction(admin, booking, "cancel").allowed).toBe(true);
    });

    it("allows owner to cancel BOOKED", () => {
      expect(canPerformAction(owner, booking, "cancel").allowed).toBe(true);
    });

    it("denies checkin on BOOKED", () => {
      expect(canPerformAction(admin, booking, "checkin").allowed).toBe(false);
    });

    it("allows open action", () => {
      expect(canPerformAction(admin, booking, "open").allowed).toBe(true);
    });

    it("allows extend", () => {
      expect(canPerformAction(staff, booking, "extend").allowed).toBe(true);
    });
  });

  // ── OPEN state ──
  describe("OPEN state", () => {
    const booking = makeCheckout("OPEN");

    it("allows admin to cancel OPEN checkout", () => {
      expect(canPerformAction(admin, booking, "cancel").allowed).toBe(true);
    });

    it("allows staff to cancel OPEN checkout", () => {
      expect(canPerformAction(staff, booking, "cancel").allowed).toBe(true);
    });

    it("denies student from cancelling OPEN checkout (even owner)", () => {
      const result = canPerformAction(owner, booking, "cancel");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("staff or admin");
    });

    it("allows owner to checkin", () => {
      expect(canPerformAction(owner, booking, "checkin").allowed).toBe(true);
    });

    it("allows staff to checkin", () => {
      expect(canPerformAction(staff, booking, "checkin").allowed).toBe(true);
    });

    it("denies non-owner student from checking in", () => {
      expect(canPerformAction(otherStudent, booking, "checkin").allowed).toBe(false);
    });

    it("allows owner to edit OPEN checkout", () => {
      expect(canPerformAction(owner, booking, "edit").allowed).toBe(true);
    });

    it("denies open action on already-OPEN checkout", () => {
      expect(canPerformAction(admin, booking, "open").allowed).toBe(false);
    });
  });

  // ── Ownership via createdBy ──
  describe("ownership via createdBy", () => {
    const booking = makeCheckout("OPEN", "other-user", "student-1");

    it("allows creator to edit even when not requester", () => {
      expect(canPerformAction(owner, booking, "edit").allowed).toBe(true);
    });
  });
});

describe("getAllowedActions", () => {
  it("returns correct actions for OPEN checkout as admin", () => {
    const booking = makeCheckout("OPEN");
    const actions = getAllowedActions(admin, booking);
    expect(actions).toContain("edit");
    expect(actions).toContain("extend");
    expect(actions).toContain("cancel");
    expect(actions).toContain("checkin");
    expect(actions).not.toContain("open");
  });

  it("returns correct actions for BOOKED checkout as owner", () => {
    const booking = makeCheckout("BOOKED");
    const actions = getAllowedActions(owner, booking);
    expect(actions).toContain("edit");
    expect(actions).toContain("extend");
    expect(actions).toContain("cancel");
    expect(actions).toContain("open");
    expect(actions).not.toContain("checkin");
  });

  it("returns empty array for COMPLETED checkout", () => {
    const booking = makeCheckout("COMPLETED");
    expect(getAllowedActions(admin, booking)).toEqual([]);
  });

  it("returns empty array for CANCELLED checkout", () => {
    const booking = makeCheckout("CANCELLED");
    expect(getAllowedActions(admin, booking)).toEqual([]);
  });

  it("student non-owner gets no actions on OPEN", () => {
    const booking = makeCheckout("OPEN");
    // Student cancel is denied, other actions require ownership
    const actions = getAllowedActions(otherStudent, booking);
    expect(actions).toEqual([]);
  });
});
