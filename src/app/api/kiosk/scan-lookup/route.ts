import { db } from "@/lib/db";
import { withKiosk } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";

/** Look up an item by QR code or asset tag */
export const POST = withKiosk(async (req) => {
  const body = await req.json();
  const scanValue = (body.scanValue as string)?.trim();

  if (!scanValue) {
    throw new HttpError(400, "Scan value required");
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

  const assetSelect = {
    id: true,
    assetTag: true,
    name: true,
    status: true,
    category: { select: { name: true } },
  } as const;

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
