import { z } from "zod";

/**
 * Zod schemas for the kiosk-route boundary.
 *
 * Pair these with `Schema.parse(await req.json())` inside `withKiosk` handlers.
 * `fail()` (`src/lib/http.ts`) maps `ZodError` to a 400 with field-level
 * details, so handlers don't need to catch validation errors explicitly.
 */

const cuidish = z.string().min(1);

export const checkoutCompleteBody = z.object({
  actorId: cuidish,
  locationId: cuidish.optional(),
  items: z
    .array(z.object({ assetId: cuidish }))
    .min(1, "At least one item required"),
});
export type CheckoutCompleteBody = z.infer<typeof checkoutCompleteBody>;

export const checkinCompleteBody = z.object({
  actorId: cuidish,
});
export type CheckinCompleteBody = z.infer<typeof checkinCompleteBody>;

const scanBody = z.object({
  scanValue: z.string().trim().min(1, "Scan value required"),
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
