import { db } from "@/lib/db";
import { withKiosk } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";
import { findAssetByScanValue } from "@/lib/services/kiosk-scan";
import { scanLookupBody } from "@/lib/schemas/kiosk";

/** Look up an item by QR code or asset tag */
export const POST = withKiosk(async (req) => {
  const { scanValue } = scanLookupBody.parse(await req.json());

  const asset = await findAssetByScanValue(scanValue, {
    id: true,
    assetTag: true,
    name: true,
    status: true,
    category: { select: { name: true } },
  });

  if (!asset) {
    throw new HttpError(404, "Item not found");
  }

  // Check if checked out
  let holder: string | undefined;
  let dueAt: string | undefined;
  let bookingTitle: string | undefined;

  const activeAllocation = await db.assetAllocation.findFirst({
    where: {
      assetId: asset.id,
      active: true,
    },
    select: {
      endsAt: true,
      booking: {
        select: {
          title: true,
          requester: { select: { name: true } },
        },
      },
    },
  });

  if (activeAllocation) {
    holder = activeAllocation.booking.requester.name;
    dueAt = activeAllocation.endsAt.toISOString();
    bookingTitle = activeAllocation.booking.title;
  }

  // Determine display status
  let status = "Available";
  if (asset.status === "MAINTENANCE") status = "In Maintenance";
  else if (asset.status === "RETIRED") status = "Retired";
  else if (activeAllocation) {
    status =
      activeAllocation.endsAt < new Date() ? "Overdue" : "Checked Out";
  }

  return ok({
    item: {
      id: asset.id,
      tagName: asset.assetTag,
      productName: asset.name || asset.assetTag,
      type: asset.category?.name || "Unknown",
      status,
      holder,
      dueAt,
      bookingTitle,
    },
  });
});
