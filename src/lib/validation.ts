import { Role, ShiftArea, ShiftWorkerType, StudentYear } from "@prisma/client";
import { z } from "zod";
import { sanitizeText } from "./sanitize";

/** Sanitize user-facing text fields in a booking payload */
export function sanitizeBookingFields<T extends Record<string, unknown>>(data: T): T {
  const d = data as Record<string, unknown>;
  if (typeof d.title === "string") d.title = sanitizeText(d.title);
  if (typeof d.notes === "string") d.notes = sanitizeText(d.notes);
  return data;
}

const bulkItemSchema = z.object({
  bulkSkuId: z.string().cuid(),
  quantity: z.number().int().positive()
});

export const availabilitySchema = z.object({
  locationId: z.string().cuid(),
  startsAt: z.string(),
  endsAt: z.string(),
  serializedAssetIds: z.array(z.string().cuid()).default([]),
  bulkItems: z.array(bulkItemSchema).default([]),
  excludeBookingId: z.string().cuid().optional()
});

const bookingBaseShape = {
  title: z.string().trim().min(1).max(500),
  requesterUserId: z.string().cuid(),
  locationId: z.string().cuid(),
  startsAt: z.string(),
  endsAt: z.string(),
  serializedAssetIds: z.array(z.string().cuid()).default([]),
  bulkItems: z.array(bulkItemSchema).default([]),
  eventId: z.string().cuid().optional(),
  eventIds: z.array(z.string().cuid()).max(3).optional(),
  sportCode: z.string().max(10).optional(),
  notes: z.string().max(10000).optional(),
  shiftAssignmentId: z.string().cuid().optional(),
  kitId: z.string().cuid().optional(),
} as const;

function eventIdsExclusive(v: { eventId?: string; eventIds?: string[] }): boolean {
  return !(v.eventId && v.eventIds && v.eventIds.length > 0);
}
const eventIdsExclusiveMsg = {
  message: "Provide either eventId or eventIds, not both",
  path: ["eventIds"] as (string | number)[],
};

export const createReservationSchema = z.object(bookingBaseShape).refine(eventIdsExclusive, eventIdsExclusiveMsg);

export const createCheckoutSchema = z.object({
  ...bookingBaseShape,
  sourceReservationId: z.string().cuid().optional(),
}).refine(eventIdsExclusive, eventIdsExclusiveMsg);

export const startScanSessionSchema = z.object({
  phase: z.enum(["CHECKOUT", "CHECKIN"]),
  deviceContext: z.string().max(500).optional()
});

export const scanSchema = z.object({
  phase: z.enum(["CHECKOUT", "CHECKIN"]),
  scanType: z.enum(["SERIALIZED", "BULK_BIN"]),
  scanValue: z.string().trim().min(1),
  quantity: z.number().int().positive().optional(),
  unitNumbers: z.array(z.number().int().positive()).optional(),
  deviceContext: z.string().max(500).optional()
});

export const checkinReportSchema = z.object({
  assetId: z.string().min(1),
  type: z.enum(["DAMAGED", "LOST"]),
  description: z.string().max(1000).optional(),
});

export const overrideSchema = z.object({
  reason: z.string().min(5).max(1000),
  details: z.record(z.unknown()).optional()
});

export const createBulkSkuSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  categoryId: z.string().cuid().nullable().optional(),
  unit: z.string().min(1).default("ea"),
  locationId: z.string().cuid(),
  binQrCodeValue: z.string().min(1),
  minThreshold: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
  initialQuantity: z.number().int().min(0).default(0),
  trackByNumber: z.boolean().default(false)
});

export const updateBulkSkuSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  category: z.string().optional(),
  categoryId: z.string().cuid().nullable().optional(),
  departmentId: z.string().cuid().nullable().optional(),
  unit: z.string().min(1).max(100).optional(),
  locationId: z.string().cuid().optional(),
  binQrCodeValue: z.string().min(1).max(500).optional(),
  minThreshold: z.number().int().min(0).optional(),
  purchasePrice: z.number().nonnegative().nullable().optional(),
  purchaseLink: z.string().url().max(2000).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  active: z.boolean().optional(),
}).strict();

export const addBulkUnitsSchema = z.object({
  count: z.number().int().min(1).max(500)
});

export const updateBulkUnitSchema = z.object({
  status: z.enum(["AVAILABLE", "LOST", "RETIRED"]),
  notes: z.string().max(1000).optional()
});

export const adjustBulkSchema = z.object({
  quantityDelta: z.number().int().refine((x) => x !== 0, "quantityDelta cannot be 0"),
  reason: z.string().min(3).max(500)
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  rememberMe: z.boolean().optional()
});

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128)
});

export const forgotPasswordSchema = z.object({
  email: z.string().email()
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128)
});

export const roleSchema = z.nativeEnum(Role);

// Fields a user is allowed to edit on their own profile.
// Direct report and assignments are intentionally excluded — staff/admin only.
export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().max(30).nullable().optional(),
  locationId: z.string().cuid().nullable().optional(),
  title: z.string().max(120).nullable().optional(),
  athleticsEmail: z.string().email().max(255).nullable().optional(),
  startDate: z.string().datetime().nullable().optional(),
  gradYear: z.number().int().min(1900).max(2100).nullable().optional(),
  studentYearOverride: z.nativeEnum(StudentYear).nullable().optional(),
  topSize: z.string().max(40).nullable().optional(),
  bottomSize: z.string().max(40).nullable().optional(),
  shoeSize: z.string().max(40).nullable().optional()
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8).max(128)
});

export const updateUserRoleSchema = z.object({
  role: z.nativeEnum(Role)
});

export const updateBookingSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  requesterUserId: z.string().cuid().optional(),
  locationId: z.string().cuid().optional(),
  startsAt: z.string().datetime({ offset: true }).optional(),
  endsAt: z.string().datetime({ offset: true }).optional(),
  serializedAssetIds: z.array(z.string().cuid()).optional(),
  bulkItems: z.array(bulkItemSchema).optional(),
  notes: z.string().max(10000).optional()
});

export const extendBookingSchema = z.object({
  endsAt: z.string().datetime({ offset: true })
});

export const sportShiftConfigSchema = z.object({
  area: z.nativeEnum(ShiftArea),
  homeCount: z.number().int().min(0).max(20),
  awayCount: z.number().int().min(0).max(20),
});

export const upsertSportConfigSchema = z.object({
  sportCode: z.string().min(1).max(10),
  active: z.boolean().optional(),
  shiftConfigs: z.array(sportShiftConfigSchema).optional(),
  shiftStartOffset: z.number().int().min(0).max(480).optional(),
  shiftEndOffset: z.number().int().min(0).max(480).optional(),
});

export const updateSportConfigSchema = z.object({
  active: z.boolean().optional(),
  shiftConfigs: z.array(sportShiftConfigSchema).optional(),
  shiftStartOffset: z.number().int().min(0).max(480).optional(),
  shiftEndOffset: z.number().int().min(0).max(480).optional(),
});

/** Group update — apply the same patch atomically to N sport codes. */
export const updateSportConfigGroupSchema = z
  .object({
    codes: z.array(z.string().min(1).max(10)).min(1).max(10),
    active: z.boolean().optional(),
    shiftConfigs: z.array(sportShiftConfigSchema).optional(),
    shiftStartOffset: z.number().int().min(0).max(480).optional(),
    shiftEndOffset: z.number().int().min(0).max(480).optional(),
  })
  .refine(
    (d) =>
      d.active !== undefined ||
      d.shiftConfigs !== undefined ||
      d.shiftStartOffset !== undefined ||
      d.shiftEndOffset !== undefined,
    { message: "Provide at least one field to update" }
  );

export const sportRosterSchema = z.object({
  userId: z.string().cuid(),
  sportCode: z.string().min(1).max(10),
});

export const sportRosterBulkSchema = z.object({
  userIds: z.array(z.string().cuid()).min(1),
  sportCode: z.string().min(1).max(10),
});

export const createShiftSchema = z.object({
  shiftGroupId: z.string().cuid(),
  area: z.nativeEnum(ShiftArea),
  workerType: z.nativeEnum(ShiftWorkerType),
  startsAt: z.string(),
  endsAt: z.string(),
  notes: z.string().max(5000).optional(),
});

export const updateShiftSchema = z.object({
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  notes: z.string().max(5000).optional(),
});

export const updateShiftGroupSchema = z.object({
  isPremier: z.boolean().optional(),
  notes: z.string().max(5000).optional(),
});

export const assignShiftSchema = z.object({
  shiftId: z.string().cuid(),
  userId: z.string().cuid(),
  notes: z.string().max(5000).optional(),
});

export const requestShiftSchema = z.object({
  shiftId: z.string().cuid(),
  notes: z.string().max(5000).optional(),
});

export const swapShiftSchema = z.object({
  targetUserId: z.string().cuid(),
});

export const postTradeSchema = z.object({
  shiftAssignmentId: z.string().cuid(),
  notes: z.string().max(5000).optional(),
});

export const studentAreaSchema = z.object({
  userId: z.string().cuid(),
  area: z.nativeEnum(ShiftArea),
  isPrimary: z.boolean().default(false),
});

export const updateUserSchedulingSchema = z.object({
  phone: z.string().max(20).optional().nullable(),
  primaryArea: z.nativeEnum(ShiftArea).optional().nullable(),
});

export const createAllowedEmailSchema = z.object({
  email: z.string().email(),
  role: z.enum(["STAFF", "STUDENT"]).default("STUDENT"),
});

export const createAllowedEmailBulkSchema = z.object({
  emails: z.array(z.object({
    email: z.string().email(),
    role: z.enum(["STAFF", "STUDENT"]).default("STUDENT"),
  })).min(1).max(50),
});

export const createGuideSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  category: z.string().min(1, "Category is required").max(100),
  content: z.unknown(),
  published: z.boolean().optional().default(false),
});

export const updateGuideSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  category: z.string().min(1).max(100).optional(),
  content: z.unknown().optional(),
  published: z.boolean().optional(),
  // Optimistic concurrency: client sends the updatedAt of the guide it loaded.
  expectedUpdatedAt: z.string().datetime().optional(),
});
