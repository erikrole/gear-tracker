import { z } from "zod";

/**
 * Zod schemas for the kiosk-route boundary.
 *
 * Pair these with `Schema.parse(await req.json())` inside `withKiosk` handlers.
 * `fail()` (`src/lib/http.ts`) maps `ZodError` to a 400 with field-level
 * details, so handlers don't need to catch validation errors explicitly.
 */

const cuidish = z.string().min(1);

const checkoutCompleteItem = z.union([
  z.object({ assetId: cuidish }),
  z.object({
    bulkSkuId: cuidish,
    unitNumber: z.number().int().positive(),
  }),
]);

export const checkoutCompleteBody = z.object({
  actorId: cuidish,
  locationId: cuidish.optional(),
  items: z.array(checkoutCompleteItem).min(1, "At least one item required"),
  eventId: cuidish.optional(),
  customPurpose: z.string().trim().min(1).max(160).optional(),
  // No startsAt: checkout start is server-authoritative (the moment of completion).
  endsAt: z.string().datetime({ offset: true }).optional(),
}).superRefine((body, ctx) => {
  if (!body.eventId && !body.customPurpose) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["eventId"],
      message: "Select an event or enter what this checkout is for",
    });
  }
});
export type CheckoutCompleteBody = z.infer<typeof checkoutCompleteBody>;

export const checkoutAvailabilityBody = z.object({
  locationId: cuidish.optional(),
  items: z.array(checkoutCompleteItem).min(1, "At least one item required"),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
});
export type CheckoutAvailabilityBody = z.infer<typeof checkoutAvailabilityBody>;

export const activeCheckoutUpdateBody = z.object({
  actorId: cuidish,
  title: z.string().trim().min(1).max(160).optional(),
  endsAt: z.string().datetime({ offset: true }).optional(),
}).refine((body) => body.title !== undefined || body.endsAt !== undefined, {
  message: "Title or return time is required",
});
export type ActiveCheckoutUpdateBody = z.infer<typeof activeCheckoutUpdateBody>;

export const activeCheckoutAddItemBody = z.object({
  actorId: cuidish,
  scanValue: z.string().trim().min(1, "Scan value required"),
});
export type ActiveCheckoutAddItemBody = z.infer<typeof activeCheckoutAddItemBody>;

export const activeCheckoutRemoveItemBody = z.object({
  actorId: cuidish,
  assetId: cuidish.optional(),
  bulkSkuId: cuidish.optional(),
  unitNumber: z.number().int().positive().optional(),
}).refine((body) => {
  const serialized = !!body.assetId;
  const bulkUnit = !!body.bulkSkuId && body.unitNumber !== undefined;
  return serialized !== bulkUnit;
}, {
  message: "Provide either assetId or bulkSkuId plus unitNumber",
});
export type ActiveCheckoutRemoveItemBody = z.infer<typeof activeCheckoutRemoveItemBody>;

export const checkinCompleteBody = z.object({
  actorId: cuidish,
});
export type CheckinCompleteBody = z.infer<typeof checkinCompleteBody>;

const scanBody = z.object({
  scanValue: z.string().trim().min(1, "Scan value required"),
  actorId: cuidish.optional(),
});

export const checkinScanBody = scanBody;
export const checkoutScanBody = scanBody;
export const pickupScanBody = scanBody;
export const scanLookupBody = scanBody;

export const pickupConfirmBody = z.object({
  actorId: cuidish,
});
export type PickupConfirmBody = z.infer<typeof pickupConfirmBody>;

export const activateBody = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Invalid activation code format"),
});
export type ActivateBody = z.infer<typeof activateBody>;
