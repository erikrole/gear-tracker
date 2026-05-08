import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const PUBLIC_HANDLER_ROUTES = [
  "src/app/api/auth/forgot-password/route.ts",
  "src/app/api/auth/login/route.ts",
  "src/app/api/auth/register/route.ts",
  "src/app/api/auth/reset-password/route.ts",
  "src/app/api/kiosk/activate/route.ts",
  "src/app/api/seed/route.ts",
] as const;

const SEED_ROUTE = "src/app/api/seed/route.ts";

function sourceFor(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

describe("public API route abuse-control contract", () => {
  it("keeps unauthenticated public routes rate-limited by client IP", () => {
    const missingRateLimits = PUBLIC_HANDLER_ROUTES.filter((route) => route !== SEED_ROUTE)
      .filter((route) => {
        const source = sourceFor(route);
        return !/\b(?:checkRateLimit|enforceRateLimit)\s*\(/.test(source) || !/\bgetClientIp\s*\(/.test(source);
      });

    expect(missingRateLimits).toEqual([]);
  });

  it("keeps the seed endpoint disabled unless explicitly enabled", () => {
    const source = sourceFor(SEED_ROUTE);

    expect(source).toContain('process.env.SEED_ENDPOINT_ENABLED === "true"');
    expect(source).toMatch(/\bassertSeedEnabled\s*\(/);
    expect(source).toMatch(/\bthrow\s+new\s+HttpError\s*\(\s*404\s*,\s*"Not found"\s*\)/);
    expect(source).toMatch(/\bwithAuth\s*\(/);
  });
});
