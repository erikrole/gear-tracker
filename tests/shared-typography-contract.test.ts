import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("shared typography contracts", () => {
  it("keeps page titles readable instead of truncating them", () => {
    const header = readFileSync("src/components/PageHeader.tsx", "utf8");

    expect(header).toContain('className="min-w-0 break-words text-wrap-balance"');
    expect(header).not.toContain('<h1 className="truncate');
    expect(header).toContain("max-w-2xl text-pretty");
  });

  it("does not synthesize missing font weights or styles", () => {
    const globals = readFileSync("src/app/globals.css", "utf8");

    expect(globals).toContain("font-synthesis: none;");
  });

  it("keeps operational table numbers aligned as values change", () => {
    const table = readFileSync("src/components/ui/table.tsx", "utf8");

    expect(table).toContain('"w-full caption-bottom text-sm tabular-nums"');
  });

  it("keeps clipped operational evidence reachable in full", () => {
    const truncatedText = readFileSync("src/components/ui/truncated-text.tsx", "utf8");
    const importMapping = readFileSync("src/app/(app)/import/_components/ImportMappingStep.tsx", "utf8");
    const calendarSources = readFileSync("src/app/(app)/settings/calendar-sources/page.tsx", "utf8");
    const bulkLosses = readFileSync("src/app/(app)/reports/bulk-losses/page.tsx", "utf8");

    expect(truncatedText).toContain("node.scrollWidth > node.clientWidth");
    expect(truncatedText).toContain("tabIndex={isTruncated ? 0 : undefined}");
    expect(truncatedText).toContain("<TooltipContent");
    expect(importMapping).toContain('<TruncatedText text={csvSample[0]?.[colIdx] || "—"} />');
    expect(calendarSources).toContain("<TruncatedText text={s} />");
    expect(bulkLosses).toContain('text={unit.notes}');
  });
});
