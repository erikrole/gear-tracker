import { describe, expect, it } from "vitest";
import { createCheckoutSchema, createReservationSchema } from "@/lib/validation";

const ids = {
  requester: "cm000000000000000000000001",
  location: "cm000000000000000000000002",
  asset: "cm000000000000000000000003",
  bulk: "cm000000000000000000000004",
  bulkTwo: "cm000000000000000000000005",
  event: "cm000000000000000000000006",
  eventTwo: "cm000000000000000000000007",
  sourceReservation: "cm000000000000000000000008",
};

const basePayload = {
  title: "Road trip kit",
  requesterUserId: ids.requester,
  locationId: ids.location,
  startsAt: "2026-06-01T12:00:00.000Z",
  endsAt: "2026-06-01T18:00:00.000Z",
};

describe("booking create validation", () => {
  it("requires reservation creation to include equipment", () => {
    expect(() => createReservationSchema.parse(basePayload)).toThrow("Add at least one piece of equipment");
  });

  it("allows checkout conversion payloads to omit explicit equipment when sourceReservationId is present", () => {
    expect(() => createCheckoutSchema.parse({
      ...basePayload,
      sourceReservationId: ids.sourceReservation,
    })).not.toThrow();
  });

  it("requires ad hoc checkout creation to include equipment", () => {
    expect(() => createCheckoutSchema.parse(basePayload)).toThrow("Add at least one piece of equipment");
  });

  it("rejects duplicate eventIds before booking creation", () => {
    expect(() => createCheckoutSchema.parse({
      ...basePayload,
      serializedAssetIds: [ids.asset],
      eventIds: [ids.event, ids.event],
    })).toThrow("eventIds must be unique");
  });

  it("rejects duplicate bulk items before booking creation", () => {
    expect(() => createReservationSchema.parse({
      ...basePayload,
      bulkItems: [
        { bulkSkuId: ids.bulk, quantity: 1 },
        { bulkSkuId: ids.bulk, quantity: 2 },
      ],
    })).toThrow("Duplicate bulk item");
  });

  it("accepts mixed serialized and unique bulk equipment", () => {
    const parsed = createReservationSchema.parse({
      ...basePayload,
      serializedAssetIds: [ids.asset],
      bulkItems: [
        { bulkSkuId: ids.bulk, quantity: 1 },
        { bulkSkuId: ids.bulkTwo, quantity: 2 },
      ],
      eventIds: [ids.event, ids.eventTwo],
    });

    expect(parsed.serializedAssetIds).toEqual([ids.asset]);
    expect(parsed.bulkItems).toHaveLength(2);
  });
});
