/**
 * Shared avatar utilities — centralized initials + deterministic color-coded fallbacks.
 * Import these instead of computing initials or fallback styling inline.
 */

/** Extract 2-letter initials from a name (e.g., "Ben Snyder" → "BS") */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Deterministic light/dark-safe palette for avatar fallbacks. Each entry pairs
 * a tinted background with text that meets contrast in both modes.
 */
const FALLBACK_PALETTE = [
  "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
  "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
  "bg-pink-100 text-pink-700 dark:bg-pink-950/50 dark:text-pink-300",
] as const;

/**
 * Map a stable seed (typically `user.name`) to a palette entry.
 * djb2-ish hash so the same input always yields the same hue.
 */
export function avatarColorClass(seed: string): string {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) + h + seed.charCodeAt(i)) | 0;
  }
  return FALLBACK_PALETTE[Math.abs(h) % FALLBACK_PALETTE.length];
}
