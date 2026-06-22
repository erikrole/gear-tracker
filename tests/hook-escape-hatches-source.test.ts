import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const TARGETS = [
  "src/hooks/use-last-audit.ts",
  "src/hooks/useBookingDetail.ts",
  "src/components/create-booking/use-event-context.ts",
  "src/components/BookingListPage.tsx",
  "src/components/booking-wizard/BookingWizard.tsx",
  "src/components/equipment-picker/use-conflict-check.ts",
  "src/app/(app)/items/[id]/page.tsx",
  "src/app/(app)/notifications/page.tsx",
  "src/app/(app)/items/hooks/use-items-query.ts",
] as const;

describe("hook dependency escape hatches", () => {
  it("keeps react-hooks dependency suppressions documented", () => {
    for (const file of TARGETS) {
      const lines = readFileSync(file, "utf8").split(/\r?\n/);

      lines.forEach((line, index) => {
        if (!line.includes("eslint-disable") || !line.includes("react-hooks/exhaustive-deps")) return;

        const rationale = lines
          .slice(Math.max(0, index - 3), index)
          .join("\n")
          .toLowerCase();

        expect(
          rationale,
          `${file}:${index + 1} must explain why exhaustive-deps is intentionally suppressed`,
        ).toMatch(/intentional|key|stable|derived|primary|identity|churn|navigation|reset/);
      });
    }
  });

  it("keeps cache update callbacks keyed by primitive URL or id inputs", () => {
    const bookingDetail = readFileSync("src/hooks/useBookingDetail.ts", "utf8");
    const notifications = readFileSync("src/app/(app)/notifications/page.tsx", "utf8");
    const items = readFileSync("src/app/(app)/items/hooks/use-items-query.ts", "utf8");

    expect(bookingDetail).toContain('queryClient.setQueryData<BookingDetail>(["booking", id]');
    expect(notifications).toContain('queryClient.setQueryData<Record<string, unknown>>(["fetch", fetchUrl]');
    expect(items).toContain('queryClient.setQueryData<AssetsResponse>(["items", url]');

    expect(bookingDetail).not.toContain("react-hooks/exhaustive-deps");
    expect(notifications).not.toContain("react-hooks/exhaustive-deps");
    expect(items).not.toContain("react-hooks/exhaustive-deps");
  });
});
