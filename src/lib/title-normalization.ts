import { SPORT_CODE_SET } from "./sports";

const LOWERCASE_TITLE_WORDS = new Set([
  "a", "an", "and", "at", "but", "by", "for", "from", "in", "of", "on", "or", "the", "to", "vs", "with",
]);

const WORD_PATTERN = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;

/** Standardize an operational title while preserving UW sport codes and camel-cased product names. */
export function normalizeOperationalTitle(value: string): string {
  const title = value.trim().replace(/\s+/g, " ");
  const words = [...title.matchAll(WORD_PATTERN)];

  return title.replace(WORD_PATTERN, (word, offset: number) => {
    const normalizedCode = word.toUpperCase();
    if (SPORT_CODE_SET.has(normalizedCode)) return normalizedCode;

    const wordIndex = words.findIndex((match) => match.index === offset);
    const lower = word.toLocaleLowerCase("en-US");
    const isEdgeWord = wordIndex === 0 || wordIndex === words.length - 1;
    if (!isEdgeWord && LOWERCASE_TITLE_WORDS.has(lower)) return lower;

    if (/\p{Ll}.*\p{Lu}/u.test(word)) return word;
    return lower.replace(/\p{L}/u, (letter) => letter.toLocaleUpperCase("en-US"));
  });
}

export const normalizeBookingTitle = normalizeOperationalTitle;
export const normalizeManualEventTitle = normalizeOperationalTitle;
