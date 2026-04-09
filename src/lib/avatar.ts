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

