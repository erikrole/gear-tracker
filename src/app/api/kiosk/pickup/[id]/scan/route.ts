import { db } from "@/lib/db";
import { withKiosk } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";

/**
 * Scan an item for kiosk pickup flow.
 * Validates that the scanned item belongs to the PENDING_PICKUP booking.
 */
export const POST = withKiosk<{ id: string }>(async (req, { params }) => {
  const body = await req.json();
  const scanValue = (body.scanValue as string)?.trim();

  if (!scanValue) {
    throw new HttpError(400, "Scan value required");
  }

  const booking = await db.booking.findUnique({
    where: { id: params.id },
    select: { id: true, status: true, kind: true },
  });

  if (!booking || booking.kind !== "CHECKOUT" || booking.status !== "PENDING_PICKUP") {
    throw new HttpError(404, "Pending pickup not found");
  }

  // Parse QR code format
  let assetId: string | null = null;
  let tagSearch: string | null = null;

  const qrMatch = scanValue.match(/^bg:\/\/item\/(.+)$/);
  if (qrMatch) {
    assetId = qrMatch[1];
  } else {
    tagSearch = scanValue;
  }

  const assetSelect = { id: true, assetTag: true, name: true } as const;

  const asset = assetId
    ? await db.asset.findUnique({ where: { id: assetId }, select: assetSelect })
    : await db.asset.findFirst({
        where: { assetTag: { equals: tagSearch!, mode: "insensitive" } },
        select: assetSelect,
      });

  if (!asset) {
    return ok({ success: false, error: "Item not found" });
  }

  const bookingItem = await db.bookingSerializedItem.findUnique({
    where: { bookingId_assetId: { bookingId: params.id, assetId: asset.id } },
  });

  if (!bookingItem) {
    return ok({ success: false, error: `${asset.assetTag} is not in this checkout` });
  }

  return ok({
    success: true,
    item: {
      id: asset.id,
      name: asset.name || asset.assetTag,
      tagName: asset.assetTag,
    },
  });
});
