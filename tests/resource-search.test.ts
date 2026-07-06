import { ResourceType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { RESOURCE_TYPE_LABELS } from "@/lib/guide-categories";
import {
  BODY_MATCH_CHARS,
  buildResourceSearchIndex,
  buildSectionNav,
  selectRecentEntries,
  splitFeaturedGuides,
} from "@/lib/resource-search";
import type { GuideListItem } from "@/lib/guides";

function guide(overrides: Partial<GuideListItem> & Pick<GuideListItem, "id" | "title" | "slug">): GuideListItem {
  return {
    type: ResourceType.GENERAL,
    category: "General",
    summary: "",
    searchText: "",
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
        searchText: "smb://ath01-nas.uwia.wisc.edu/users/",
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
      guide({ id: "1", title: "Long", slug: "long", searchText: "x".repeat(5000) }),
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

describe("buildSectionNav", () => {
  const sop = ResourceType.SOP;
  const howTo = ResourceType.HOW_TO;

  function list(): GuideListItem[] {
    return [
      guide({ id: "b", title: "Beta SOP", slug: "beta", type: sop }),
      guide({ id: "a", title: "Alpha SOP", slug: "alpha", type: sop }),
      guide({ id: "c", title: "Gamma SOP", slug: "gamma", type: sop }),
      guide({ id: "x", title: "Lonely how-to", slug: "lonely", type: howTo }),
    ];
  }

  it("groups same-type guides title-sorted with the current one flagged", () => {
    const nav = buildSectionNav(list(), "b");
    expect(nav.typeLabel).toBe(RESOURCE_TYPE_LABELS[sop]);
    expect(nav.siblings.map((s) => s.slug)).toEqual(["alpha", "beta", "gamma"]);
    expect(nav.siblings.find((s) => s.current)?.slug).toBe("beta");
  });

  it("derives prev/next from title order", () => {
    const nav = buildSectionNav(list(), "b");
    expect(nav.prev?.slug).toBe("alpha");
    expect(nav.next?.slug).toBe("gamma");
  });

  it("has no prev at the start and no next at the end", () => {
    expect(buildSectionNav(list(), "a").prev).toBeNull();
    expect(buildSectionNav(list(), "c").next).toBeNull();
  });

  it("returns empty nav for a section of one", () => {
    const nav = buildSectionNav(list(), "x");
    expect(nav.siblings).toEqual([]);
    expect(nav.prev).toBeNull();
    expect(nav.next).toBeNull();
  });

  it("returns empty nav when the current guide is not in the list", () => {
    expect(buildSectionNav(list(), "missing").siblings).toEqual([]);
  });
});

describe("splitFeaturedGuides", () => {
  it("keeps every guide in the library and none featured when nothing is flagged", () => {
    const guides = [
      guide({ id: "1", title: "A", slug: "a" }),
      guide({ id: "2", title: "B", slug: "b" }),
    ];
    const { featured, library } = splitFeaturedGuides(guides);
    expect(featured).toEqual([]);
    expect(library.map((g) => g.id)).toEqual(["1", "2"]);
  });

  it("orders featured by rank then removes them from the library", () => {
    const guides = [
      guide({ id: "plain", title: "Plain", slug: "plain" }),
      guide({ id: "r2", title: "Rank2", slug: "r2", featured: true, featuredRank: 2 }),
      guide({ id: "r1", title: "Rank1", slug: "r1", featured: true, featuredRank: 1 }),
    ];
    const { featured, library } = splitFeaturedGuides(guides);
    expect(featured.map((g) => g.id)).toEqual(["r1", "r2"]);
    expect(library.map((g) => g.id)).toEqual(["plain"]);
  });

  it("sorts unranked featured guides last, by most-recent", () => {
    const guides = [
      guide({ id: "unranked-old", title: "UO", slug: "uo", featured: true, featuredRank: null, updatedAt: new Date("2026-01-01") }),
      guide({ id: "ranked", title: "R", slug: "r", featured: true, featuredRank: 5, updatedAt: new Date("2026-01-01") }),
      guide({ id: "unranked-new", title: "UN", slug: "un", featured: true, featuredRank: null, updatedAt: new Date("2026-07-01") }),
    ];
    const { featured } = splitFeaturedGuides(guides);
    expect(featured.map((g) => g.id)).toEqual(["ranked", "unranked-new", "unranked-old"]);
  });

  it("preserves input order within the library", () => {
    const guides = [
      guide({ id: "c", title: "C", slug: "c" }),
      guide({ id: "feat", title: "F", slug: "f", featured: true, featuredRank: 1 }),
      guide({ id: "a", title: "A", slug: "a" }),
    ];
    expect(splitFeaturedGuides(guides).library.map((g) => g.id)).toEqual(["c", "a"]);
  });
});
