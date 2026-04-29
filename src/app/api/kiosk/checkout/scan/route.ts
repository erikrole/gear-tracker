import { db } from "@/lib/db";
import { withKiosk } from "@/lib/api";
import { ok } from "@/lib/http";
import { findAssetByScanValue } from "@/lib/services/kiosk-scan";
import { checkoutScanBody } from "@/lib/schemas/kiosk";

/**
 * Scan an item for kiosk checkout.
 * Validates the item exists and is available, returns item info.
 * Does NOT create a booking yet — that happens on complete.
 */
export const POST = withKiosk(async (req) => {
  const { scanValue } = checkoutScanBody.parse(await req.json());

  const asset = await findAssetByScanValue(scanValue, {
    id: true,
    assetTag: true,
    name: true,
    status: true,
    category: { select: { name: true } },
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
