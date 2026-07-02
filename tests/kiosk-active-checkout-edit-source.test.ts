import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

describe("kiosk active checkout edits", () => {
  it("keeps active checkout mutations kiosk-authenticated, scoped, audited, and transactional", () => {
    const route = source("src/app/api/kiosk/checkout/[id]/route.ts");
    const schemas = source("src/lib/schemas/kiosk.ts");

    expect(route).toContain("export const PATCH = withKiosk");
    expect(route).toContain("export const POST = withKiosk");
    expect(route).toContain("export const DELETE = withKiosk");
    expect(route).toContain("status: \"OPEN\"");
    expect(route).toContain("locationId: args.locationId");
    expect(route).toContain("Prisma.TransactionIsolationLevel.Serializable");
    expect(route).toContain("createAuditEntryTx(tx");
    expect(route).toContain("checkAvailability(tx");
    expect(route).toContain("excludeBookingId: booking.id");
    expect(route).toContain("findAssetByScanValue(scanValue");
    expect(route).toContain("findBulkUnitByScanValue(scanValue)");
    expect(route).toContain("BulkMovementKind.CHECKOUT");
    expect(route).toContain("BulkMovementKind.CHECKIN");
    expect(route).toContain("data: { active: false }");

    expect(schemas).toContain("activeCheckoutUpdateBody");
    expect(schemas).toContain("activeCheckoutAddItemBody");
    expect(schemas).toContain("activeCheckoutRemoveItemBody");
    expect(schemas).toContain("Provide either assetId or bulkSkuId plus unitNumber");
  });

  it("wires the native kiosk drawer to update, add, and remove through the kiosk API", () => {
    const client = source("ios/Wisconsin/Kiosk/KioskAPIClient.swift");
    const models = source("ios/Wisconsin/Kiosk/KioskModels.swift");
    const drawer = source("ios/Wisconsin/Kiosk/KioskCheckoutDetailSheet.swift");
    const dashboardRoute = source("src/app/api/kiosk/dashboard/route.ts");

    expect(dashboardRoute).toContain("requesterId: c.requester.id");
    expect(dashboardRoute).toContain("requesterId: entry.booking.requester.id");
    expect(models).toContain("let requesterId: String?");
    expect(models).toContain("struct KioskActiveCheckoutMutationResult");

    expect(client).toContain("func kioskUpdateActiveCheckout(");
    expect(client).toContain("func kioskAddActiveCheckoutItem(");
    expect(client).toContain("func kioskRemoveActiveCheckoutItem(");
    expect(client).toContain("request(path: \"/api/kiosk/checkout/\\(id)\", method: \"PATCH\")");
    expect(client).toContain("request(path: \"/api/kiosk/checkout/\\(id)\", method: \"POST\")");
    expect(client).toContain("request(path: \"/api/kiosk/checkout/\\(id)\", method: \"DELETE\")");

    expect(drawer).toContain("private var editPanel: some View");
    expect(drawer).toContain("KioskNativeTextField(");
    expect(drawer).toContain("DatePicker(");
    expect(drawer).toContain("await saveDetails()");
    expect(drawer).toContain("await addItem()");
    expect(drawer).toContain("await removeItem(removable)");
    expect(drawer).toContain("onChanged()");
  });
});
