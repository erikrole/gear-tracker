import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const reportsDirectory = "src/app/(app)/reports";

function reportSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return reportSourceFiles(path);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

describe("report chart color contract", () => {
  it("keeps report source free of HSL color literals", () => {
    for (const path of reportSourceFiles(reportsDirectory)) {
      expect(readFileSync(path, "utf8"), path).not.toMatch(/\bhsla?\(/i);
    }
  });

  it("centralizes categorical, semantic, and overdue chart colors", () => {
    const source = readFileSync(join(reportsDirectory, "report-ui.tsx"), "utf8");

    expect(source.match(/var\(--report-chart-\d+\)/g)).toHaveLength(8);
    expect(source.match(/var\(--report-overdue-\d+\)/g)).toHaveLength(10);
    expect(source).toContain('active: "var(--chart-1)"');
    expect(source).toContain('available: "var(--chart-2)"');
    expect(source).toContain('reserved: "var(--chart-3)"');
    expect(source).toContain('waiting: "var(--chart-4)"');
    expect(source).toContain('problem: "var(--chart-5)"');
  });
});
