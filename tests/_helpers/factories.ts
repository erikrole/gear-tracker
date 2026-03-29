/**
 * Data factories for tests. Minimal defaults, override-friendly, no DB dependency.
 */

let counter = 0;
function uid() { return `test-${++counter}`; }

export function makeUser(overrides: Record<string, unknown> = {}) {
  const id = uid();
  return {
    id,
    email: `${id}@test.com`,
    name: `Test User ${id}`,
    role: "STUDENT" as const,
    primaryArea: null,
    avatarUrl: null,
    ...overrides,
  };
}

export function makeBooking(overrides: Record<string, unknown> = {}) {
  const id = uid();
  return {
    id,
    kind: "CHECKOUT" as const,
    status: "OPEN" as const,
    title: `Booking ${id}`,
    refNumber: `CO-0001`,
    requesterUserId: uid(),
    locationId: uid(),
    startsAt: new Date("2026-04-01T08:00:00Z"),
    endsAt: new Date("2026-04-01T17:00:00Z"),
    createdBy: uid(),
    notes: null,
    sourceReservationId: null,
    eventId: null,
    sportCode: null,
    shiftAssignmentId: null,
    kitId: null,
    serializedItems: [],
    bulkItems: [],
    ...overrides,
  };
}

export function makeSerializedItem(overrides: Record<string, unknown> = {}) {
  const id = uid();
  return {
    id,
    bookingId: uid(),
    assetId: uid(),
    allocationStatus: "active" as const,
    ...overrides,
  };
}

export function makeBulkItem(overrides: Record<string, unknown> = {}) {
  const id = uid();
  return {
    id,
    bookingId: uid(),
    bulkSkuId: uid(),
    plannedQuantity: 10,
    checkedOutQuantity: 0,
    checkedInQuantity: 0,
    ...overrides,
  };
}

export function makeAsset(overrides: Record<string, unknown> = {}) {
  const id = uid();
  return {
    id,
    assetTag: `TAG-${id}`,
    qrCodeValue: `QR-${id}`,
    primaryScanCode: null,
    status: "AVAILABLE" as const,
    availableForCheckout: true,
    availableForReservation: true,
    ...overrides,
  };
}

export function makeShiftTrade(overrides: Record<string, unknown> = {}) {
  const id = uid();
  return {
    id,
    shiftAssignmentId: uid(),
    postedByUserId: uid(),
    claimedByUserId: null,
    claimedAt: null,
    resolvedAt: null,
    status: "OPEN" as const,
    requiresApproval: false,
    notes: null,
    ...overrides,
  };
}

export function makeShiftAssignment(overrides: Record<string, unknown> = {}) {
  const id = uid();
  return {
    id,
    shiftId: uid(),
    userId: uid(),
    status: "DIRECT_ASSIGNED" as const,
    assignedBy: null,
    swapFromId: null,
    ...overrides,
  };
}

export function makeShift(overrides: Record<string, unknown> = {}) {
  const id = uid();
  return {
    id,
    area: "Field",
    startsAt: new Date("2026-04-01T08:00:00Z"),
    endsAt: new Date("2026-04-01T16:00:00Z"),
    shiftGroupId: uid(),
    ...overrides,
  };
}

export function makeBulkSku(overrides: Record<string, unknown> = {}) {
  const id = uid();
  return {
    id,
    name: `Bulk SKU ${id}`,
    binQrCodeValue: `BIN-${id}`,
    trackByNumber: false,
    unit: "each",
    ...overrides,
  };
}

export function makeBulkStockBalance(overrides: Record<string, unknown> = {}) {
  return {
    bulkSkuId: uid(),
    locationId: uid(),
    onHandQuantity: 100,
    ...overrides,
  };
}

/** Reset counter between tests if needed */
export function resetFactoryCounter() {
  counter = 0;
}
