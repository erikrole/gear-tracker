import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const APP_SCAN_ROUTES = [
  {
    route: "src/app/api/checkouts/[id]/scan/route.ts",
    message: "Checkout scanning must be done at a kiosk",
  },
  {
    route: "src/app/api/checkouts/[id]/checkin-scan/route.ts",
    message: "Check-in scanning must be done at a kiosk",
  },
] as const;

const APP_SCAN_LINK_SURFACES = [
  "src/app/(app)/bookings/BookingDetailPage.tsx",
  "src/app/(app)/dashboard/overdue-banner.tsx",
  "src/app/(app)/scan/page.tsx",
  "src/components/AppShell.tsx",
  "src/components/Sidebar.tsx",
] as const;

function sourceFor(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

describe("app scan route gate contract", () => {
  it("keeps booking execution scans gated to kiosk routes", () => {
    const drift = APP_SCAN_ROUTES.filter(({ route, message }) => {
      const source = sourceFor(route);
      return !/\bwithAuth\s*\(/.test(source) || !source.includes(message) || !/\bthrow\s+new\s+HttpError\s*\(\s*403\s*,/.test(source);
    }).map(({ route }) => route);

    expect(drift).toEqual([]);
  });

  it("keeps the app scan UI lookup-only", () => {
    const staleLinks = APP_SCAN_LINK_SURFACES.filter((file) =>
      sourceFor(file).includes("/scan?checkout"),
    );

    expect(staleLinks).toEqual([]);
    expect(sourceFor("src/components/AppShell.tsx")).toContain('label: "Lookup", href: "/scan"');
    expect(sourceFor("src/components/Sidebar.tsx")).toContain('{ label: "Lookup", href: "/scan"');
  });
});
