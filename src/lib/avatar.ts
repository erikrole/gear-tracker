/**
 * Shared avatar utilities — centralized initials + color-coded fallbacks.
 * Import this instead of computing initials inline.
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
 * Deterministic color for a name — same name always gets the same color.
 * Returns a Tailwind bg + text class pair for AvatarFallback.
 */
const AVATAR_COLORS = [
  "bg-red-600/15 text-red-700 dark:bg-red-400/15 dark:text-red-300",
  "bg-orange-600/15 text-orange-700 dark:bg-orange-400/15 dark:text-orange-300",
  "bg-amber-600/15 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  "bg-emerald-600/15 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
  "bg-teal-600/15 text-teal-700 dark:bg-teal-400/15 dark:text-teal-300",
  "bg-cyan-600/15 text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-300",
  "bg-blue-600/15 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300",
  "bg-violet-600/15 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300",
  "bg-purple-600/15 text-purple-700 dark:bg-purple-400/15 dark:text-purple-300",
  "bg-pink-600/15 text-pink-700 dark:bg-pink-400/15 dark:text-pink-300",
] as const;

export function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}
