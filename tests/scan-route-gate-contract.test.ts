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
});
