import { db } from "@/lib/db";
import { withKiosk } from "@/lib/api";
import { ok } from "@/lib/http";
import { findAssetByScanValue } from "@/lib/services/kiosk-scan";
import { checkoutScanBody } from "@/lib/schemas/kiosk";
import { badges } from "@/lib/badges";
import { badgeScanSourceKey } from "@/lib/badges/scan";
import type { BadgeScanErrorCode } from "@/lib/badges/types";

/**
 * Scan an item for kiosk checkout.
 * Validates the item exists and is available, returns item info.
 * Does NOT create a booking yet — that happens on complete.
 */
export const POST = withKiosk(async (req) => {
  const { actorId, scanValue } = checkoutScanBody.parse(await req.json());

  async function emitScanResult(args: { ok: boolean; errorCode?: BadgeScanErrorCode }) {
    if (!actorId) return;
    await badges.onScanResult({
      userId: actorId,
      phase: "checkout",
      ok: args.ok,
      errorCode: args.errorCode,
      sourceKey: badgeScanSourceKey({
        phase: "checkout",
        userId: actorId,
        scanValue,
        ok: args.ok,
        errorCode: args.errorCode,
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
    await emitScanResult({ ok: false, errorCode: "not_found" });
    return ok({ success: false, error: "Item not found" });
  }

  if (asset.status === "RETIRED") {
    const error = `${asset.assetTag} is retired`;
    await emitScanResult({ ok: false, errorCode: "retired" });
    return ok({ success: false, error });
  }

  if (asset.status === "MAINTENANCE") {
    const error = `${asset.assetTag} is in maintenance`;
    await emitScanResult({ ok: false, errorCode: "wrong_status" });
    return ok({ success: false, error });
  }

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
    await emitScanResult({ ok: false, errorCode: "already_checked_out" });
    return ok({ success: false, error });
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
