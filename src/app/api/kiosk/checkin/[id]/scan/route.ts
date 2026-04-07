import { db } from "@/lib/db";
import { withKiosk } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";

/**
 * Scan an item for kiosk check-in (return).
 * Marks the item as returned in the booking.
 */
export const POST = withKiosk<{ id: string }>(async (req, { params }) => {
  const body = await req.json();
  const scanValue = (body.scanValue as string)?.trim();

  if (!scanValue) {
    throw new HttpError(400, "Scan value required");
  }

  // Find the booking
  const booking = await db.booking.findUnique({
    where: { id: params.id },
    select: { id: true, status: true, kind: true },
  });

  if (!booking || booking.kind !== "CHECKOUT" || booking.status !== "OPEN") {
    throw new HttpError(404, "Active checkout not found");
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

  // Find the asset
  const asset = assetId
    ? await db.asset.findUnique({
        where: { id: assetId },
        select: assetSelect,
      })
    : await db.asset.findFirst({
        where: { assetTag: { equals: tagSearch!, mode: "insensitive" } },
        select: assetSelect,
      });

  if (!asset) {
    return ok({ success: false, error: "Item not found" });
  }

  // Check it's part of this booking
  const bookingItem = await db.bookingSerializedItem.findUnique({
    where: {
      bookingId_assetId: {
        bookingId: params.id,
        assetId: asset.id,
      },
    },
  });

  if (!bookingItem) {
    return ok({
      success: false,
      error: `${asset.assetTag} is not in this checkout`,
    });
  }

  if (bookingItem.allocationStatus === "returned") {
    return ok({
      success: false,
      error: `${asset.assetTag} already returned`,
    });
  }

  // Mark as returned
  await db.bookingSerializedItem.update({
    where: { id: bookingItem.id },
    data: { allocationStatus: "returned" },
  });

  // Deactivate allocation
  await db.assetAllocation.updateMany({
    where: {
      bookingId: params.id,
      assetId: asset.id,
      active: true,
    },
    data: { active: false },
  });

  return ok({
    success: true,
    item: {
      id: asset.id,
      name: asset.name || asset.assetTag,
      tagName: asset.assetTag,
    },
  });
});
