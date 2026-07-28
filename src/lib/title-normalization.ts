import { SPORT_CODE_SET } from "./sports";

const LOWERCASE_TITLE_WORDS = new Set([
  "a", "an", "and", "at", "but", "by", "for", "from", "in", "of", "on", "or", "the", "to", "vs", "with",
]);

/**
 * Terms that are always written in full caps, regardless of how they were typed or imported.
 * Sport codes are handled separately via SPORT_CODE_SET. Only add terms that are never a
 * normal English word in lowercase, otherwise ordinary titles get shouted at.
 */
export const ALWAYS_UPPERCASE_TERMS = new Set([
  // Conference and governing bodies
  "B1G", "NCAA", "BTN",
  // Broadcast and media partners
  "ESPN", "FS1", "CBS", "NBC", "ABC",
  // Gear and production shorthand
  "AV", "TV", "LED", "SDI", "XLR", "USB", "HDMI", "DSLR", "4K", "UHD", "HD",
  // Program shorthand
  "UW", "NIL", "VIP",
]);

const WORD_PATTERN = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;

/** Standardize an operational title while preserving UW sport codes and camel-cased product names. */
export function normalizeOperationalTitle(value: string): string {
  const title = value.trim().replace(/\s+/g, " ");
  const words = [...title.matchAll(WORD_PATTERN)];

  return title.replace(WORD_PATTERN, (word, offset: number) => {
    const normalizedCode = word.toUpperCase();
    if (SPORT_CODE_SET.has(normalizedCode)) return normalizedCode;
    if (ALWAYS_UPPERCASE_TERMS.has(normalizedCode)) return normalizedCode;

    // "b1g's" / "uw's" keep the term uppercase and the possessive lowercase.
    const possessive = /^(.+)(['’])s$/iu.exec(word);
    if (possessive) {
      const stem = (possessive[1] ?? "").toUpperCase();
      if (SPORT_CODE_SET.has(stem) || ALWAYS_UPPERCASE_TERMS.has(stem)) {
        return `${stem}${possessive[2]}s`;
      }
    }

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
