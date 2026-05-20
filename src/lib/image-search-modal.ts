import type { ImageSearchResult } from "@/lib/image-search";

const SEARCH_BIAS = "product photo white background";
const B_AND_H_SITE_OPERATOR = "site:bhphotovideo.com";
const MAX_DISPLAY_SEARCH_RESULTS = 8;

type MergeImageSearchOptions = {
  primaryLimit?: number;
};

export function buildBiasedImageSearchQuery(query: string) {
  const trimmed = query.trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  const biasTerms = SEARCH_BIAS.split(" ");
  return [
    trimmed,
    ...biasTerms.filter((term) => !lower.includes(term)),
  ].filter(Boolean).join(" ");
}

export function buildBandHImageSearchQuery(query: string) {
  const trimmed = query.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  return `${trimmed} ${B_AND_H_SITE_OPERATOR}`;
}

export function buildImageSearchSuggestions(query: string): string[] {
  const trimmed = query.replace(/\s+/g, " ").trim();
  if (!trimmed) return [];
  const suggestions = [
    trimmed,
    `${trimmed} product photo`,
    `${trimmed} front`,
    `${trimmed} kit`,
  ];
  return suggestions.filter((suggestion, index) => suggestions.indexOf(suggestion) === index).slice(0, 4);
}

export function mergeImageSearchResults(
  primary: ImageSearchResult[],
  fallback: ImageSearchResult[],
  options: MergeImageSearchOptions = {},
) {
  const seenUrls = new Set<string>();
  const seenThumbnails = new Set<string>();
  const results: ImageSearchResult[] = [];
  const primaryResults = typeof options.primaryLimit === "number" ? primary.slice(0, options.primaryLimit) : primary;

  for (const result of [...primaryResults, ...fallback]) {
    if (seenUrls.has(result.url) || seenThumbnails.has(result.thumbnailUrl)) continue;
    seenUrls.add(result.url);
    if (result.thumbnailUrl) seenThumbnails.add(result.thumbnailUrl);
    results.push(result);
  }

  return results.slice(0, MAX_DISPLAY_SEARCH_RESULTS);
}
