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
});
