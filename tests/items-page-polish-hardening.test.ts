import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("items page polish hardening", () => {
  it("links toolbar filter controls without changing the accepted layout", () => {
    const source = readFileSync("src/app/(app)/items/components/items-toolbar.tsx", "utf8");

    expect(source).toContain('const filtersPanelId = "items-advanced-filters"');
    expect(source).toContain('autoComplete="off"');
    expect(source).toContain("aria-controls={filtersPanelId}");
    expect(source).toContain("aria-label={activeFilterCount > 0 ? `Filters, ${activeFilterCount} active` : \"Filters\"}");
    expect(source).toContain('aria-label="Clear all item filters"');
    expect(source).toContain('role="group"');
    expect(source).toContain('aria-label="Advanced item filters"');
  });

  it("keeps the status summary compact while making bucket actions explicit", () => {
    const source = readFileSync("src/app/(app)/items/page.tsx", "utf8");

    expect(source).toContain('aria-label="Inventory status summary"');
    expect(source).toContain('${isActive ? "Remove" : "Apply"} ${bucket.label} status filter');
    expect(source).toContain('className="mb-4 grid gap-2 rounded-md border border-border/60 bg-muted/20 p-2');
  });

  it("names the table region, row selected state, and per-row selection checkbox", () => {
    const dataTable = readFileSync("src/app/(app)/items/data-table.tsx", "utf8");
    const columns = readFileSync("src/app/(app)/items/columns.tsx", "utf8");

    expect(dataTable).toContain('role="region" aria-label="Items table"');
    expect(dataTable).toContain("aria-selected={row.getIsSelected()}");
    expect(columns).toContain("`Select ${row.original.assetTag}`");
    expect(columns).not.toContain('aria-label={canSelect ? "Select row"');
  });
});
