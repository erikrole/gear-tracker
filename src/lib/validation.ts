import { BookingKind, BookingStatus, Role, ShiftArea, ShiftWorkerType } from "@prisma/client";
import { z } from "zod";

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

export const createReservationSchema = z.object({
  title: z.string().min(1),
  requesterUserId: z.string().cuid(),
  locationId: z.string().cuid(),
  startsAt: z.string(),
  endsAt: z.string(),
  serializedAssetIds: z.array(z.string().cuid()).default([]),
  bulkItems: z.array(bulkItemSchema).default([]),
  eventId: z.string().cuid().optional(),
  sportCode: z.string().max(10).optional(),
  notes: z.string().max(10000).optional()
});

export const updateReservationSchema = createReservationSchema
  .partial()
  .extend({ status: z.nativeEnum(BookingStatus).optional() });

export const createCheckoutSchema = z.object({
  title: z.string().min(1),
  requesterUserId: z.string().cuid(),
  locationId: z.string().cuid(),
  startsAt: z.string(),
  endsAt: z.string(),
  serializedAssetIds: z.array(z.string().cuid()).default([]),
  bulkItems: z.array(bulkItemSchema).default([]),
  sourceReservationId: z.string().cuid().optional(),
  eventId: z.string().cuid().optional(),
  sportCode: z.string().max(10).optional(),
  notes: z.string().max(10000).optional()
});

export const startScanSessionSchema = z.object({
  phase: z.enum(["CHECKOUT", "CHECKIN"]),
  deviceContext: z.string().max(500).optional()
});

export const scanSchema = z.object({
  phase: z.enum(["CHECKOUT", "CHECKIN"]),
  scanType: z.enum(["SERIALIZED", "BULK_BIN"]),
  scanValue: z.string().min(1),
  quantity: z.number().int().positive().optional(),
  unitNumbers: z.array(z.number().int().positive()).optional(),
  deviceContext: z.string().max(500).optional()
});

export const overrideSchema = z.object({
  reason: z.string().min(5).max(1000),
  details: z.record(z.unknown()).optional()
});

export const createBulkSkuSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  categoryId: z.string().cuid().nullable().optional(),
  unit: z.string().min(1),
  locationId: z.string().cuid(),
  binQrCodeValue: z.string().min(1),
  minThreshold: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
  initialQuantity: z.number().int().min(0).default(0),
  trackByNumber: z.boolean().default(false)
});

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
  name: z.string().min(1).max(100),
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

export const bookingKindSchema = z.nativeEnum(BookingKind);


export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  locationId: z.string().cuid().nullable().optional()
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8).max(128)
});

export const updateUserRoleSchema = z.object({
  role: z.nativeEnum(Role)
});

export const updateBookingSchema = z.object({
  title: z.string().min(1).optional(),
  requesterUserId: z.string().cuid().optional(),
  locationId: z.string().cuid().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  serializedAssetIds: z.array(z.string().cuid()).optional(),
  bulkItems: z.array(bulkItemSchema).optional(),
  notes: z.string().max(10000).optional()
});

export const extendBookingSchema = z.object({
  endsAt: z.string()
});

// ── Shift Calendar Schemas ──────────────────────────────

export const shiftAreaSchema = z.nativeEnum(ShiftArea);
export const shiftWorkerTypeSchema = z.nativeEnum(ShiftWorkerType);

export const sportShiftConfigSchema = z.object({
  area: z.nativeEnum(ShiftArea),
  homeCount: z.number().int().min(0).max(20),
  awayCount: z.number().int().min(0).max(20),
});

export const upsertSportConfigSchema = z.object({
  sportCode: z.string().min(1).max(10),
  active: z.boolean().optional(),
  shiftConfigs: z.array(sportShiftConfigSchema).optional(),
});

export const updateSportConfigSchema = z.object({
  active: z.boolean().optional(),
  isPremierDefault: z.boolean().optional(),
  shiftConfigs: z.array(sportShiftConfigSchema).optional(),
});

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
