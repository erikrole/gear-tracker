import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  getBookingCancelCopy,
  getReservationConvertCopy,
} from "@/hooks/booking-action-copy";

function sourceFor(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

describe("booking detail custody contracts", () => {
  it("keeps full-detail bulk returns out of the desktop booking page", () => {
    const detailSource = sourceFor("src/app/(app)/bookings/BookingDetailPage.tsx");
    const equipmentSource = sourceFor("src/app/(app)/bookings/BookingEquipmentTab.tsx");

    expect(detailSource).not.toContain("onCheckinBulk={actions.checkinBulk}");
    expect(equipmentSource).toContain("!!onCheckinBulk");
    expect(equipmentSource).toContain("Return All");
  });

  it("describes reservation conversion as a pending pickup, not active custody", () => {
    expect(getReservationConvertCopy("Lens weekend")).toEqual({
      title: "Start checkout from reservation?",
      message: 'Create a pending pickup from "Lens weekend". The reservation closes, and gear custody still begins at kiosk pickup.',
      confirmLabel: "Start checkout",
      success: "Checkout pending pickup",
      successDescription: "Open the checkout to complete pickup at the kiosk.",
      missingLinkError: "Checkout started, but the response did not include a checkout link. Refresh the page.",
    });
  });

  it("names cancellation as an irreversible release of equipment commitments", () => {
    expect(getBookingCancelCopy("CHECKOUT", "Camera pickup")).toEqual({
      title: "Cancel checkout?",
      message: 'Cancel "Camera pickup" and release its equipment commitments. The record stays in history, and the checkout cannot be reopened.',
      confirmLabel: "Cancel checkout",
      success: "Checkout cancelled",
    });
  });
});
