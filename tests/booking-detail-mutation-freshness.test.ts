import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(`${process.cwd()}/${relativePath}`, "utf8");
}

describe("booking detail mutation freshness contracts", () => {
  it("keeps the authoritative booking timestamp after an inline save", () => {
    const actions = source("src/hooks/useBookingActions.ts");
    const page = source("src/app/(app)/bookings/BookingDetailPage.tsx");
    const infoCard = source("src/components/booking-details/BookingInfoCard.tsx");
    const sheet = source("src/components/BookingDetailsSheet.tsx");
    const transferDialog = source("src/components/booking-details/TransferOwnerDialog.tsx");

    expect(actions).toContain("const json = await parseJsonSafely<BookingMutationResponse>(res);");
    expect(actions).toContain("return json.data;");
    expect(page).toContain('const updated = await actions.saveField("title", v);');
    expect(page).toContain("patchLocal(updated);");
    expect(page).not.toContain("patchLocal({ title: v });");
    expect(infoCard).toContain('const updated = await onSave("startsAt", iso);');
    expect(infoCard).toContain('const updated = await onSave("endsAt", iso);');
    expect(infoCard).toContain('const updated = await onSave("notes", v || null);');
    expect(sheet).toContain("if (json?.data) setBooking(json.data);");
    expect(transferDialog).toContain("let updated: BookingDetail;");
    expect(transferDialog).toContain("onTransferred(updated);");
    expect(page).toMatch(/onTransferred=\{\(updated\) => \{\s*patchLocal\(updated\);\s*\}\}/);
  });
});
