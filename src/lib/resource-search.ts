import { inferResourceTypeFromCategory, RESOURCE_TYPE_LABELS } from "@/lib/guide-categories";
import { markdownToPlainText } from "@/lib/guide-content";
import type { GuideListItem } from "@/lib/guides";

// How much guide body text to feed the fuzzy matcher. Enough to match a phrase
// buried in a guide without making every keystroke score huge strings.
export const BODY_MATCH_CHARS = 800;

export type ResourceSearchEntry = {
  guide: GuideListItem;
  typeLabel: string;
  /** Space-joined haystack handed to cmdk for fuzzy matching. */
  value: string;
};

/**
 * Build the client-side search index for the Resources command palette. Matching
 * spans title, category, typed focus label, author, and a bounded body excerpt so
 * a search finds guides by content, not just title.
 */
export function buildResourceSearchIndex(guides: GuideListItem[]): ResourceSearchEntry[] {
  return guides.map((guide) => {
    const type = guide.type ?? inferResourceTypeFromCategory(guide.category);
    const typeLabel = RESOURCE_TYPE_LABELS[type];
    const body = markdownToPlainText(guide.markdown ?? "").slice(0, BODY_MATCH_CHARS);
    return {
      guide,
      typeLabel,
      value: [guide.title, guide.category, typeLabel, guide.author.name, body]
        .filter(Boolean)
        .join(" "),
    };
  });
}

/** Most-recently-updated entries first, capped to `count`. */
export function selectRecentEntries(
  entries: ResourceSearchEntry[],
  count: number,
): ResourceSearchEntry[] {
  return [...entries]
    .sort(
      (a, b) =>
        new Date(b.guide.updatedAt).getTime() - new Date(a.guide.updatedAt).getTime(),
    )
    .slice(0, count);
}
