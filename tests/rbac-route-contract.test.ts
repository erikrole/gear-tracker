import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { PERMISSIONS } from "@/lib/permissions";

const API_ROOT = path.join(process.cwd(), "src/app/api");

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) return routeFiles(fullPath);
    return entry === "route.ts" ? [fullPath] : [];
  });
}

describe("route RBAC permission contract", () => {
  it("only references defined resource/action permissions", () => {
    const calls = routeFiles(API_ROOT).flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return Array.from(
        source.matchAll(/requirePermission\s*\([^,]+,\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']/g),
        (match) => ({
          file: path.relative(process.cwd(), file),
          resource: match[1]!,
          action: match[2]!,
        }),
      );
    });

    expect(calls.length).toBeGreaterThan(0);
    const missing = calls.filter(({ resource, action }) => !PERMISSIONS[resource]?.[action]);

    expect(missing).toEqual([]);
  });
});
