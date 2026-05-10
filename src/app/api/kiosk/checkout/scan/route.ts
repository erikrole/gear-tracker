import { db } from "@/lib/db";
import { withKiosk } from "@/lib/api";
import { ok } from "@/lib/http";
import { findAssetByScanValue } from "@/lib/services/kiosk-scan";
import { checkoutScanBody } from "@/lib/schemas/kiosk";
import { badges } from "@/lib/badges";
import { badgeScanErrorCode, badgeScanSourceKey } from "@/lib/badges/scan";

/**
 * Scan an item for kiosk checkout.
 * Validates the item exists and is available, returns item info.
 * Does NOT create a booking yet — that happens on complete.
 */
export const POST = withKiosk(async (req) => {
  const { actorId, scanValue } = checkoutScanBody.parse(await req.json());

  async function emitScanResult(args: { ok: boolean; error?: string }) {
    if (!actorId) return;
    const errorCode = args.error ? badgeScanErrorCode(args.error) : undefined;
    await badges.onScanResult({
      userId: actorId,
      phase: "checkout",
      ok: args.ok,
      errorCode,
      sourceKey: badgeScanSourceKey({
        phase: "checkout",
        userId: actorId,
        scanValue,
        ok: args.ok,
        errorCode,
      }),
    });
  }

  const asset = await findAssetByScanValue(scanValue, {
    id: true,
    assetTag: true,
    name: true,
    status: true,
    category: { select: { name: true } },
  });

  if (!asset) {
    await emitScanResult({ ok: false, error: "Item not found" });
    return ok({ success: false, error: "Item not found" });
  }

  if (asset.status === "RETIRED") {
    const error = `${asset.assetTag} is retired`;
    await emitScanResult({ ok: false, error });
    return ok({ success: false, error });
  }

  if (asset.status === "MAINTENANCE") {
    const error = `${asset.assetTag} is in maintenance`;
    await emitScanResult({ ok: false, error });
    return ok({ success: false, error });
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
    const error = `${asset.assetTag} is checked out by ${activeAllocation.booking.requester.name}`;
    await emitScanResult({ ok: false, error });
    return ok({
      success: false,
      error,
    });
  }

  await emitScanResult({ ok: true });

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
