import { ResourceType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { RESOURCE_TYPE_LABELS } from "@/lib/guide-categories";
import {
  BODY_MATCH_CHARS,
  buildResourceSearchIndex,
  selectRecentEntries,
} from "@/lib/resource-search";
import type { GuideListItem } from "@/lib/guides";

function guide(overrides: Partial<GuideListItem> & Pick<GuideListItem, "id" | "title" | "slug">): GuideListItem {
  return {
    type: ResourceType.GENERAL,
    category: "General",
    summary: "",
    markdown: "",
    targetRoles: [],
    targetAreas: [],
    featured: false,
    featuredRank: null,
    lastVerifiedAt: null,
    lastVerifiedBy: null,
    personalizationReason: "General",
    published: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    author: { id: "u1", name: "Erik Role" },
    ...overrides,
  };
}

describe("buildResourceSearchIndex", () => {
  it("builds a haystack spanning title, category, type label, author, and body", () => {
    const entry = buildResourceSearchIndex([
      guide({
        id: "1",
        title: "Media Drive paths",
        slug: "media-drive",
        type: ResourceType.SERVER_PATHS,
        category: "Reference",
        markdown: "smb://ath01-nas.uwia.wisc.edu/users/",
      }),
    ])[0]!;

    expect(entry.typeLabel).toBe(RESOURCE_TYPE_LABELS[ResourceType.SERVER_PATHS]);
    expect(entry.value).toContain("Media Drive paths");
    expect(entry.value).toContain("Reference");
    expect(entry.value).toContain(entry.typeLabel);
    expect(entry.value).toContain("Erik Role");
    expect(entry.value).toContain("ath01-nas.uwia.wisc.edu");
  });

  it("caps the body excerpt so long guides do not bloat the matcher", () => {
    const entry = buildResourceSearchIndex([
      guide({ id: "1", title: "Long", slug: "long", markdown: "x".repeat(5000) }),
    ])[0]!;

    expect(entry.value.length).toBeLessThan(BODY_MATCH_CHARS + 200);
  });

  it("infers a type label from category when type is absent", () => {
    const entry = buildResourceSearchIndex([
      // Simulate a legacy row missing the typed focus.
      guide({ id: "1", title: "Legacy", slug: "legacy", type: undefined as unknown as ResourceType, category: "Troubleshooting" }),
    ])[0]!;

    expect(entry.typeLabel.length).toBeGreaterThan(0);
    expect(entry.value).toContain(entry.typeLabel);
  });
});

describe("selectRecentEntries", () => {
  it("returns the most-recently-updated guides first, capped to count", () => {
    const entries = buildResourceSearchIndex([
      guide({ id: "old", title: "Old", slug: "old", updatedAt: new Date("2026-01-01") }),
      guide({ id: "new", title: "New", slug: "new", updatedAt: new Date("2026-07-01") }),
      guide({ id: "mid", title: "Mid", slug: "mid", updatedAt: new Date("2026-04-01") }),
    ]);

    const recent = selectRecentEntries(entries, 2);
    expect(recent.map((e) => e.guide.id)).toEqual(["new", "mid"]);
  });

  it("does not mutate the input array", () => {
    const entries = buildResourceSearchIndex([
      guide({ id: "a", title: "A", slug: "a", updatedAt: new Date("2026-01-01") }),
      guide({ id: "b", title: "B", slug: "b", updatedAt: new Date("2026-07-01") }),
    ]);
    const before = entries.map((e) => e.guide.id);
    selectRecentEntries(entries, 5);
    expect(entries.map((e) => e.guide.id)).toEqual(before);
  });
});
