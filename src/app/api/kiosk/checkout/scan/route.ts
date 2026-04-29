import { db } from "@/lib/db";
import { withKiosk } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";

/**
 * Scan an item for kiosk checkout.
 * Validates the item exists and is available, returns item info.
 * Does NOT create a booking yet — that happens on complete.
 */
export const POST = withKiosk(async (req) => {
  const body = await req.json();
  const scanValue = (body.scanValue as string)?.trim();

  if (!scanValue) {
    throw new HttpError(400, "Scan value required");
  }

  // Parse QR code format: bg://item/<uuid> or raw tag name
  let assetId: string | null = null;
  let tagSearch: string | null = null;

  const qrMatch = scanValue.match(/^bg:\/\/item\/(.+)$/);
  if (qrMatch) {
    assetId = qrMatch[1];
  } else {
    tagSearch = scanValue;
  }

  const assetSelect = {
    id: true,
    assetTag: true,
    name: true,
    status: true,
    category: { select: { name: true } },
  } as const;

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

  if (asset.status === "RETIRED") {
    return ok({ success: false, error: `${asset.assetTag} is retired` });
  }

  if (asset.status === "MAINTENANCE") {
    return ok({ success: false, error: `${asset.assetTag} is in maintenance` });
  }

  // Check if already checked out
  const activeAllocation = await db.assetAllocation.findFirst({
    where: {
      assetId: asset.id,
      active: true,
      kind: "CHECKOUT",
    },
    select: {
      booking: {
        select: {
          requester: { select: { name: true } },
        },
      },
    },
  });

  if (activeAllocation) {
    return ok({
      success: false,
      error: `${asset.assetTag} is checked out by ${activeAllocation.booking.requester.name}`,
    });
  }

  return ok({
    success: true,
    item: {
      id: asset.id,
      name: asset.name || asset.assetTag,
      tagName: asset.assetTag,
      type: asset.category?.name || "Unknown",
    },
  });
});
