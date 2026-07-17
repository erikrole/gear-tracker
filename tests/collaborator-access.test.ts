import { describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";
import {
  capabilitiesForActor,
  COLLABORATOR_CAPABILITIES,
  isGlobalKioskCollaborator,
  normalizeCollaboratorCapabilities,
} from "@/lib/collaborator-access";
import { PERMISSIONS } from "@/lib/permissions";
import { canPerformBookingAction } from "@/lib/booking-action-policy";
import {
  sanitizeCollaboratorBooking,
  sanitizeCollaboratorPickerAsset,
} from "@/lib/collaborator-gear";

const dbMock = vi.hoisted(() => ({
  shiftGroup: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  user: { findMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

import { listPublishedSchedule } from "@/lib/services/collaborator-schedule";

describe("BTN collaborator authorization", () => {
  it("maps legacy BTN to the nine rollout capabilities", () => {
    expect(capabilitiesForActor({
      role: Role.COLLABORATOR,
      collaboratorProfile: "BTN_STANDARD",
    })).toEqual([...COLLABORATOR_CAPABILITIES]);
    expect(capabilitiesForActor({ role: Role.COLLABORATOR, collaboratorProfile: null })).toEqual([]);
    expect(capabilitiesForActor({ role: Role.STAFF, collaboratorProfile: "BTN_STANDARD" })).toEqual([]);
  });

  it("normalizes dependencies and derives kiosk eligibility from policy grants", () => {
    expect(normalizeCollaboratorCapabilities(["RESERVATION_CREATE"])).toEqual([
      "GEAR_CATALOG_VIEW",
      "MY_GEAR_VIEW",
      "RESERVATION_CREATE",
    ]);
    expect(normalizeCollaboratorCapabilities(["SCHEDULE_FOLLOW"])).toEqual([
      "PUBLISHED_SCHEDULE_VIEW",
      "SCHEDULE_FOLLOW",
    ]);
    expect(isGlobalKioskCollaborator({
      role: Role.COLLABORATOR,
      capabilities: ["KIOSK_ROSTER_ELIGIBLE"],
    })).toBe(true);
  });

  it("keeps COLLABORATOR default-denied in every role permission entry", () => {
    for (const [resource, actions] of Object.entries(PERMISSIONS)) {
      for (const [action, roles] of Object.entries(actions)) {
        expect(roles, `${resource}.${action}`).not.toContain(Role.COLLABORATOR);
      }
    }
  });

  it("allows only owned reservation mutations and owned booking reads", () => {
    const actor = { id: "btn-1", role: "COLLABORATOR" };
    const ownReservation = {
      kind: "RESERVATION" as const,
      status: "BOOKED",
      requesterUserId: actor.id,
      createdBy: actor.id,
    };
    const ownCheckout = { ...ownReservation, kind: "CHECKOUT" as const, status: "OPEN" };

    expect(canPerformBookingAction(actor, ownReservation, "view").allowed).toBe(true);
    expect(canPerformBookingAction(actor, ownReservation, "edit").allowed).toBe(true);
    expect(canPerformBookingAction(actor, ownReservation, "extend").allowed).toBe(true);
    expect(canPerformBookingAction(actor, ownReservation, "cancel").allowed).toBe(true);
    expect(canPerformBookingAction(actor, ownReservation, "duplicate").allowed).toBe(false);
    expect(canPerformBookingAction(actor, ownReservation, "transfer-owner").allowed).toBe(false);
    expect(canPerformBookingAction(actor, ownCheckout, "view").allowed).toBe(true);
    expect(canPerformBookingAction(actor, ownCheckout, "edit").allowed).toBe(false);
    expect(canPerformBookingAction(actor, { ...ownReservation, requesterUserId: "other", createdBy: "other" }, "view").allowed).toBe(false);
  });
});

describe("BTN response minimization", () => {
  it("removes serial, borrower, and internal asset metadata from catalog rows", () => {
    const result = sanitizeCollaboratorPickerAsset({
      id: "asset-1",
      assetTag: "CAM-1",
      name: "Camera",
      brand: "Brand",
      model: "Model",
      imageUrl: null,
      computedStatus: "CHECKED_OUT",
      location: { id: "loc-1", name: "Camp Randall" },
      category: { id: "cat-1", name: "Cameras" },
    });
    expect(result).toEqual(expect.objectContaining({
      assetTag: "CAM-1",
      model: "Model",
      availability: "UNAVAILABLE",
    }));
    expect(result).not.toHaveProperty("brand");
    expect(result).not.toHaveProperty("serialNumber");
    expect(result).not.toHaveProperty("currentHolder");
    expect(result).not.toHaveProperty("activeBooking");
  });

  it("keeps own booking details usable without asset serials or requester email", () => {
    const result = sanitizeCollaboratorBooking({
      id: "booking-1",
      refNumber: "RV-1",
      kind: "RESERVATION",
      status: "BOOKED",
      title: "Game gear",
      requesterUserId: "btn-1",
      createdBy: "btn-1",
      locationId: "loc-1",
      startsAt: new Date(),
      endsAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      location: { id: "loc-1", name: "Camp Randall" },
      requester: { id: "btn-1", name: "Trey", avatarUrl: null },
      serializedItems: [{
        id: "line-1",
        assetId: "asset-1",
        allocationStatus: "active",
        asset: { id: "asset-1", assetTag: "CAM-1", brand: "Brand", model: "Model", imageUrl: null },
      }],
      bulkItems: [],
      event: { id: "event-private", summary: "Unpublished production" },
      events: [{ id: "event-private", summary: "Unpublished production" }],
    });
    expect(result.requester).not.toHaveProperty("email");
    expect(result.serializedItems[0]?.asset).not.toHaveProperty("serialNumber");
    expect(result).not.toHaveProperty("event");
    expect(result).not.toHaveProperty("events");
  });
});

describe("published collaborator schedule", () => {
  it("renders the stored snapshot, hydrates basic crew, and removes every note", async () => {
    dbMock.shiftGroup.count.mockResolvedValue(1);
    dbMock.shiftGroup.findMany.mockResolvedValue([{
      id: "group-1",
      lastPublishedSnapshot: {
        shifts: [{
          shiftId: "shift-1",
          area: "VIDEO",
          workerType: "FT",
          startsAt: "2026-09-01T18:00:00.000Z",
          endsAt: "2026-09-01T22:00:00.000Z",
          callStartsAt: "2026-09-01T17:00:00.000Z",
          callEndsAt: null,
          assignments: [{
            id: "assignment-1",
            userId: "staff-1",
            status: "DIRECT_ASSIGNED",
            callStartsAt: null,
            callEndsAt: null,
            callNote: "private call note",
          }],
        }],
      },
      event: {
        id: "event-1",
        summary: "Wisconsin vs Michigan",
        subtitle: null,
        startsAt: new Date("2026-09-01T19:00:00.000Z"),
        endsAt: new Date("2026-09-01T22:00:00.000Z"),
        allDay: false,
        sportCode: "FB",
        opponent: "Michigan",
        isHome: true,
        location: { id: "loc-1", name: "Camp Randall" },
        follows: [{ mutedAt: null }],
      },
    }]);
    dbMock.user.findMany.mockResolvedValue([{
      id: "staff-1",
      name: "Crew Member",
      avatarUrl: null,
      title: "Producer",
      role: "STAFF",
      affiliation: null,
    }]);

    const result = await listPublishedSchedule({ userId: "btn-1", limit: 20, offset: 0 });
    expect(result.data[0]?.isFollowing).toBe(true);
    expect(result.data[0]?.crew[0]).toEqual(expect.objectContaining({
      area: "VIDEO",
      role: "FT",
      callStartsAt: "2026-09-01T17:00:00.000Z",
    }));
    expect(JSON.stringify(result)).not.toContain("private call note");
    expect(JSON.stringify(result)).not.toContain("callNote");
    expect(JSON.stringify(result)).not.toContain("publishedAt");
  });
});
