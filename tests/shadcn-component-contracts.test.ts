import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function src(relPath: string): string {
  return readFileSync(relPath, "utf8");
}

function walkTsx(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...walkTsx(full));
    } else if (entry.endsWith(".tsx")) {
      results.push(full);
    }
  }
  return results;
}

describe("shadcn component contracts", () => {
  // --- Plan 018: error boundary primitives ---

  it("keeps root error boundaries on shared UI primitives", () => {
    const errorBoundary = src("src/app/error.tsx");
    const globalErrorBoundary = src("src/app/global-error.tsx");

    expect(errorBoundary).toContain("@/components/ui/button");
    expect(globalErrorBoundary).toContain("@/components/ui/button");

    expect(errorBoundary).toContain("@/components/ui/card");
    expect(globalErrorBoundary).toContain("@/components/ui/card");

    expect(errorBoundary).toContain("<Button");
    expect(globalErrorBoundary).toContain("<Button");

    expect(errorBoundary).not.toContain("<button");
    expect(globalErrorBoundary).not.toContain("<button");

    expect(errorBoundary).not.toContain("style={{");
    expect(globalErrorBoundary).not.toContain("style={{");

    expect(globalErrorBoundary).toContain("Sentry.captureException(error)");
  });

  // --- Plan 019: SelectItem lists grouped inside SelectContent ---

  it("keeps SelectItem lists grouped inside SelectContent", () => {
    const UI_SELECT = "src/components/ui/select.tsx";

    const files = [
      ...walkTsx("src/app"),
      ...walkTsx("src/components"),
    ].filter((f) => !f.endsWith(UI_SELECT));

    const violations: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      if (!source.includes("SelectItem")) continue;

      if (!source.includes("SelectGroup")) {
        violations.push(`${file}: uses SelectItem but does not import or use SelectGroup`);
        continue;
      }

      const contentBlockRe = /<SelectContent[^>]*>([\s\S]*?)<\/SelectContent>/g;
      let match: RegExpExecArray | null;
      while ((match = contentBlockRe.exec(source)) !== null) {
        const block = match[1] ?? "";
        if (block.includes("SelectItem") && !block.includes("SelectGroup")) {
          violations.push(`${file}: <SelectContent> block contains SelectItem without SelectGroup`);
        }
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `Select composition violations found:\n${violations.map((v) => `  - ${v}`).join("\n")}`,
      );
    }
  });

  // --- Plan 020: operational status dots on StatusIndicator ---

  it("keeps operational status dots on StatusIndicator", () => {
    const primitive = readFileSync("src/components/ui/status-indicator.tsx", "utf8");

    expect(primitive).not.toContain("bg-green-500");
    expect(primitive).not.toContain("bg-red-500");
    expect(primitive).not.toContain("bg-yellow-500");
    expect(primitive).not.toContain("bg-slate-");

    const kioskPage = readFileSync("src/app/(app)/settings/kiosk-devices/page.tsx", "utf8");
    const unitsTab = readFileSync("src/app/(app)/bulk-inventory/[id]/BulkSkuUnitsTab.tsx", "utf8");
    const overviewCard = readFileSync("src/app/(app)/bulk-inventory/[id]/BulkSkuOverviewCard.tsx", "utf8");

    expect(kioskPage).toContain("StatusIndicator");
    expect(unitsTab).toContain("StatusIndicator");
    expect(overviewCard).toContain("StatusIndicator");

    expect(kioskPage).not.toContain("function StatusDot");
    expect(kioskPage).not.toContain("bg-emerald-500");
    expect(kioskPage).not.toContain("bg-amber-400");

    expect(unitsTab).not.toContain("DOT_STYLES");
    expect(overviewCard).not.toContain("DOT_STYLES");
  });
});
