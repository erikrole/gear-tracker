import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const API_ROOT = path.join(process.cwd(), "src/app/api");
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"] as const;
const WRAPPER_PATTERN = /\bwith(?:Auth|Kiosk|Handler|Cron)(?:<[^>]+>)?\s*\(/;
const WRAPPER_NAMES = ["withAuth", "withKiosk", "withHandler", "withCron"] as const;
const PUBLIC_HANDLER_ALLOWLIST = new Set([
  "src/app/api/auth/forgot-password/route.ts",
  "src/app/api/auth/login/route.ts",
  "src/app/api/auth/register/route.ts",
  "src/app/api/auth/reset-password/route.ts",
  "src/app/api/kiosk/activate/route.ts",
  "src/app/api/seed/route.ts",
]);

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) return routeFiles(fullPath);
    return entry === "route.ts" ? [fullPath] : [];
  });
}

function exportedMethodBlocks(source: string) {
  const exportPattern = new RegExp(`export\\s+const\\s+(${HTTP_METHODS.join("|")})\\b`, "g");
  const matches = Array.from(source.matchAll(exportPattern));
  return matches.map((match, index) => {
    const start = match.index ?? 0;
    const next = matches[index + 1]?.index ?? source.length;
    return {
      method: match[1]!,
      block: source.slice(start, next),
    };
  });
}

function isWrappedExport(source: string, block: string) {
  if (WRAPPER_PATTERN.test(block)) return true;

  const alias = block.match(/export\s+const\s+\w+\s*=\s*([A-Za-z_$][\w$]*)\s*;?/);
  if (!alias) return false;

  const aliasName = alias[1]!;
  const aliasDeclarationPattern = new RegExp(`\\bconst\\s+${aliasName}\\s*=\\s*[^;]*${WRAPPER_PATTERN.source}`);
  return aliasDeclarationPattern.test(source);
}

function wrapperNamesForExport(source: string, block: string) {
  const names = new Set<(typeof WRAPPER_NAMES)[number]>();
  for (const name of WRAPPER_NAMES) {
    const pattern = new RegExp(`\\b${name}(?:<[^>]+>)?\\s*\\(`);
    if (pattern.test(block)) names.add(name);
  }

  const alias = block.match(/export\s+const\s+\w+\s*=\s*([A-Za-z_$][\w$]*)\s*;?/);
  if (alias) {
    const aliasName = alias[1]!;
    const declaration = source.match(new RegExp(`\\bconst\\s+${aliasName}\\s*=\\s*([^;]+)`))?.[1] ?? "";
    for (const name of WRAPPER_NAMES) {
      const pattern = new RegExp(`\\b${name}(?:<[^>]+>)?\\s*\\(`);
      if (pattern.test(declaration)) names.add(name);
    }
  }

  return Array.from(names);
}

describe("API route wrapper contract", () => {
  it("wraps every exported HTTP method with the shared API wrappers", () => {
    const nakedExports = routeFiles(API_ROOT).flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return exportedMethodBlocks(source)
        .filter(({ block }) => !isWrappedExport(source, block))
        .map(({ method }) => `${path.relative(process.cwd(), file)}:${method}`);
    });

    expect(nakedExports).toEqual([]);
  });

  it("keeps public, kiosk, and cron wrappers on expected route families", () => {
    const wrapperDrift = routeFiles(API_ROOT).flatMap((file) => {
      const source = readFileSync(file, "utf8");
      const relativeFile = path.relative(process.cwd(), file);
      return exportedMethodBlocks(source).flatMap(({ method, block }) => {
        const wrappers = wrapperNamesForExport(source, block);
        const failures: string[] = [];

        if (wrappers.includes("withHandler") && !PUBLIC_HANDLER_ALLOWLIST.has(relativeFile)) {
          failures.push(`${relativeFile}:${method}:unexpected withHandler`);
        }
        if (wrappers.includes("withKiosk") && !relativeFile.startsWith("src/app/api/kiosk/")) {
          failures.push(`${relativeFile}:${method}:unexpected withKiosk`);
        }
        if (wrappers.includes("withCron") && !relativeFile.startsWith("src/app/api/cron/")) {
          failures.push(`${relativeFile}:${method}:unexpected withCron`);
        }

        return failures;
      });
    });

    expect(wrapperDrift).toEqual([]);
  });
});
