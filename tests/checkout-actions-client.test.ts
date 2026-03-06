import { describe, it, expect } from "vitest";
import { getAllowedActionsClient, type CheckoutAction } from "@/lib/checkout-actions";

/* ───── Test helpers ───── */

const staff = { id: "staff-1", role: "STAFF" };
const admin = { id: "admin-1", role: "ADMIN" };
const owner = { id: "student-1", role: "STUDENT" };
const nonOwner = { id: "student-2", role: "STUDENT" };

function booking(status: string, requesterId = "student-1", creatorId = "staff-1") {
  return {
    status,
    requester: { id: requesterId },
    createdBy: creatorId,
  };
}

function has(actions: CheckoutAction[], action: CheckoutAction): boolean {
  return actions.includes(action);
}

/* ───── Tests ───── */

describe("getAllowedActionsClient", () => {
  describe("BOOKED state", () => {
    const ctx = booking("BOOKED");

    it("staff can edit, extend, cancel, open", () => {
      const actions = getAllowedActionsClient(staff, ctx);
      expect(has(actions, "edit")).toBe(true);
      expect(has(actions, "extend")).toBe(true);
      expect(has(actions, "cancel")).toBe(true);
      expect(has(actions, "open")).toBe(true);
      expect(has(actions, "checkin")).toBe(false);
    });

    it("admin can edit, extend, cancel, open", () => {
      const actions = getAllowedActionsClient(admin, ctx);
      expect(has(actions, "edit")).toBe(true);
      expect(has(actions, "cancel")).toBe(true);
      expect(has(actions, "open")).toBe(true);
    });

    it("owner (student) can edit, extend, cancel, open", () => {
      const actions = getAllowedActionsClient(owner, ctx);
      expect(has(actions, "edit")).toBe(true);
      expect(has(actions, "cancel")).toBe(true);
      expect(has(actions, "open")).toBe(true);
    });

    it("non-owner student gets no actions", () => {
      const actions = getAllowedActionsClient(nonOwner, ctx);
      expect(actions).toEqual([]);
    });
  });

  describe("OPEN state", () => {
    const ctx = booking("OPEN");

    it("staff can edit, extend, cancel, checkin", () => {
      const actions = getAllowedActionsClient(staff, ctx);
      expect(has(actions, "edit")).toBe(true);
      expect(has(actions, "extend")).toBe(true);
      expect(has(actions, "cancel")).toBe(true);
      expect(has(actions, "checkin")).toBe(true);
      expect(has(actions, "open")).toBe(false);
    });

    it("owner can edit, extend, checkin but NOT cancel", () => {
      const actions = getAllowedActionsClient(owner, ctx);
      expect(has(actions, "edit")).toBe(true);
      expect(has(actions, "extend")).toBe(true);
      expect(has(actions, "checkin")).toBe(true);
      expect(has(actions, "cancel")).toBe(false);
    });

    it("non-owner student gets no actions", () => {
      const actions = getAllowedActionsClient(nonOwner, ctx);
      expect(actions).toEqual([]);
    });
  });

  describe("COMPLETED state", () => {
    it("returns empty for all roles", () => {
      const ctx = booking("COMPLETED");
      expect(getAllowedActionsClient(staff, ctx)).toEqual([]);
      expect(getAllowedActionsClient(admin, ctx)).toEqual([]);
      expect(getAllowedActionsClient(owner, ctx)).toEqual([]);
    });
  });

  describe("CANCELLED state", () => {
    it("returns empty for all roles", () => {
      const ctx = booking("CANCELLED");
      expect(getAllowedActionsClient(staff, ctx)).toEqual([]);
      expect(getAllowedActionsClient(admin, ctx)).toEqual([]);
      expect(getAllowedActionsClient(owner, ctx)).toEqual([]);
    });
  });

  describe("DRAFT state", () => {
    const ctx = booking("DRAFT");

    it("staff can edit and cancel", () => {
      const actions = getAllowedActionsClient(staff, ctx);
      expect(has(actions, "edit")).toBe(true);
      expect(has(actions, "cancel")).toBe(true);
      expect(has(actions, "extend")).toBe(false);
      expect(has(actions, "checkin")).toBe(false);
      expect(has(actions, "open")).toBe(false);
    });
  });

  describe("ownership via createdBy", () => {
    it("student who is creator but not requester has access", () => {
      const ctx = booking("OPEN", "other-student", "student-1");
      const actions = getAllowedActionsClient(owner, ctx);
      expect(has(actions, "edit")).toBe(true);
      expect(has(actions, "checkin")).toBe(true);
    });
  });

  describe("mirrors server-side checkout-rules", () => {
    it("cancel on OPEN requires staff+ (student owner cannot cancel)", () => {
      const ctx = booking("OPEN");
      expect(has(getAllowedActionsClient(owner, ctx), "cancel")).toBe(false);
      expect(has(getAllowedActionsClient(staff, ctx), "cancel")).toBe(true);
      expect(has(getAllowedActionsClient(admin, ctx), "cancel")).toBe(true);
    });
  });
});
