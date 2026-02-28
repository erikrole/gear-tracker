import { BookingKind, BookingStatus, Role } from "@prisma/client";
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
  deviceContext: z.string().max(500).optional()
});

export const overrideSchema = z.object({
  reason: z.string().min(5).max(1000),
  details: z.record(z.unknown()).optional()
});

export const createBulkSkuSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  unit: z.string().min(1),
  locationId: z.string().cuid(),
  binQrCodeValue: z.string().min(1),
  minThreshold: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
  initialQuantity: z.number().int().min(0).default(0)
});

export const adjustBulkSchema = z.object({
  quantityDelta: z.number().int().refine((x) => x !== 0, "quantityDelta cannot be 0"),
  reason: z.string().min(3).max(500)
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128)
});

export const roleSchema = z.nativeEnum(Role);

export const bookingKindSchema = z.nativeEnum(BookingKind);
