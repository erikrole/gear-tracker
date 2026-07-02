import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  featurePillars,
  forbiddenPublicMockupTerms,
  heroMockup,
  pageMockups,
  publicShowroomNav,
  securityControls,
  stackGroups,
} from "@/lib/public-showroom";

const rootLayoutSource = readFileSync("src/app/layout.tsx", "utf8");
const middlewareSource = readFileSync("src/middleware.ts", "utf8");
const themeInitSource = readFileSync("public/theme-init.js", "utf8");
const serviceWorkerInitSource = readFileSync("public/sw-init.js", "utf8");
const aboutLayoutSource = readFileSync("src/app/(public)/about/layout.tsx", "utf8");
const globalsSource = readFileSync("src/app/globals.css", "utf8");
const nextConfigSource = readFileSync("next.config.ts", "utf8");

describe("public showroom content", () => {
  it("keeps the expected public route set", () => {
    expect(publicShowroomNav.map((item) => item.href)).toEqual([
      "/about",
      "/about/features",
      "/about/tech-stack",
      "/about/security",
      "/about/field-work",
    ]);
  });

  it("gives every nav destination a cross-link description", () => {
    for (const item of publicShowroomNav) {
      expect(item.description.trim().length).toBeGreaterThan(10);
    }
  });

  it("pins the showroom to light tokens regardless of app theme", () => {
    expect(aboutLayoutSource).toContain('data-theme="light"');
    expect(globalsSource).toMatch(/:root,\s*\[data-theme="light"\]/);
  });

  it("ships share metadata and a social image for the showroom", () => {
    expect(aboutLayoutSource).toContain("metadataBase");
    expect(aboutLayoutSource).toContain("openGraph");
    expect(aboutLayoutSource).toContain("wisconsincreative.com");
    expect(existsSync("src/app/(public)/about/opengraph-image.tsx")).toBe(true);
  });

  it("keeps feature, stack, and security sections populated", () => {
    expect(featurePillars.length).toBeGreaterThanOrEqual(6);
    expect(stackGroups.length).toBeGreaterThanOrEqual(4);
    expect(securityControls.length).toBeGreaterThanOrEqual(6);
  });

  it("does not include known live-user or incident identifiers in public mockups", () => {
    const content = JSON.stringify({
      heroMockup,
      pageMockups,
      featurePillars,
      stackGroups,
      securityControls,
    });

    for (const term of forbiddenPublicMockupTerms) {
      expect(content).not.toContain(term);
    }
  });

  it("keeps the public shell static-friendly on Vercel", () => {
    expect(rootLayoutSource).not.toContain("next/headers");
    expect(rootLayoutSource).not.toContain("dangerouslySetInnerHTML");
    expect(rootLayoutSource).toContain('src="/theme-init.js"');
    expect(rootLayoutSource).toContain('src="/sw-init.js"');
    expect(existsSync("src/middleware.ts")).toBe(true);
    expect(middlewareSource).not.toContain("x-csp-nonce");
    expect(middlewareSource).toContain("/__next-build-sentinel/:path*");
  });

  it("keeps boot scripts same-origin and CSP-compatible", () => {
    expect(themeInitSource).toContain('localStorage.getItem("theme")');
    expect(themeInitSource).toContain('localStorage.getItem("text-scale")');
    expect(serviceWorkerInitSource).toContain('navigator.serviceWorker.register("/sw.js")');
    expect(serviceWorkerInitSource).toContain("getRegistrations");
    expect(`${themeInitSource}\n${serviceWorkerInitSource}`).not.toContain("https://");
  });

  it("keeps production CSP compatible with Next App Router inline bootstrap", () => {
    expect(nextConfigSource).toContain("script-src 'self' 'unsafe-inline'");
    expect(nextConfigSource).toContain("Next App Router emits inline bootstrap/RSC scripts");
  });
});
