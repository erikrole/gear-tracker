import type { BadgeProps } from "@/components/ui/badge";

type BadgeDisplayInput = {
  key: string;
  category: string;
  kind: string;
  trigger: string;
  threshold: number | null;
};

export type BadgeRarity = "Common" | "Uncommon" | "Rare" | "Legendary";

export const customBadgeIconOptions = [
  "Trophy",
  "BadgeCheck",
  "ShieldCheck",
  "UserCheck",
  "Handshake",
  "Flame",
  "PackageCheck",
] as const;

export type CustomBadgeIcon = typeof customBadgeIconOptions[number];

const HIDDEN_BADGE_KEYS = new Set([
  "above_and_beyond",
  "event_hero",
  "clean_loop",
]);

const LEGENDARY_BADGE_KEYS = new Set([
  "above_and_beyond",
  "category_collector",
  "checkout_100",
]);

const RARE_BADGE_KEYS = new Set([
  "event_hero",
  "clean_loop",
  "perfect_handoff",
  "full_kit_no_misses",
  "semester_streak",
  "reliable_regular",
]);

const UNCOMMON_BADGE_KEYS = new Set([
  "clutch_cover",
  "rookie_run",
  "zero_errors",
  "streak_on_time_5",
  "streak_shifts_5",
]);

export const manualAwardGuidance: Record<string, string> = {
  perfect_handoff: "Use when every item came back on time, accounted for, and without damage or loss reports.",
  clean_loop: "Use when the full gear workflow stayed clean from checkout through return.",
  clutch_cover: "Use when someone helped cover a late or urgent shift need.",
  full_kit_no_misses: "Use for a large kit or complex checkout returned with every piece accounted for.",
  semester_streak: "Use at semester end for someone with no overdue gear in the period.",
  category_collector: "Use when someone has earned recognition across every major badge category.",
  event_hero: "Use for standout help during an event day.",
  rookie_run: "Use for a first clean end-to-end gear workflow.",
  reliable_regular: "Use for a sustained stretch with no overdue gear or missed commitments.",
  above_and_beyond: "Use sparingly for memorable help that made the operation better.",
};

export function isCustomBadgeKey(key: string): boolean {
  return key.startsWith("custom_");
}

export function isHiddenUntilEarnedBadge(key: string): boolean {
  return HIDDEN_BADGE_KEYS.has(key);
}

export function formatBadgeCategoryLabel(category: string): string {
  return category
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatBadgeSourceLabel(source: string): string {
  return formatBadgeCategoryLabel(source);
}

/** Definitions younger than this are rated by difficulty, not by scarcity. */
export const RARITY_PROVING_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Rarity from how hard a badge looks, used when scarcity cannot speak yet.
 * This is the old hardcoded behaviour, kept only as the fallback it should
 * always have been.
 */
function difficultyRarity(badge: BadgeDisplayInput): BadgeRarity {
  if (LEGENDARY_BADGE_KEYS.has(badge.key)) return "Legendary";
  if (RARE_BADGE_KEYS.has(badge.key) || (badge.threshold ?? 0) >= 50) return "Rare";
  if (isCustomBadgeKey(badge.key)) return "Uncommon";
  if (
    UNCOMMON_BADGE_KEYS.has(badge.key) ||
    (badge.threshold ?? 0) >= 10 ||
    (badge.kind === "RULE" && badge.trigger === "manual")
  ) {
    return "Uncommon";
  }
  return "Common";
}

export type BadgeRarityInput = BadgeDisplayInput & {
  /** How many people hold this badge. */
  holders?: number;
  /** How many people could hold it -- active users. */
  eligible?: number;
  /** When the definition was created, for the proving period. */
  createdAt?: Date | string | null;
};

/**
 * Rarity from how many people actually hold a badge.
 *
 * This used to be four hardcoded key lists, and they had drifted into saying
 * the opposite of the truth: `zero_errors` was labelled Uncommon while being
 * among the most-held badges in the system, and `checkout_25` was Common with
 * nobody holding it at all. Scarcity is a fact the database already knows.
 *
 * Two guards keep the fact from lying in the other direction. A badge nobody
 * has earned is not Legendary, it is unproven -- otherwise every badge added to
 * the catalog would launch as the rarest thing in it. Same for a badge that has
 * not been available long enough for anyone to reach. Both fall back to rating
 * by difficulty.
 */
export function getBadgeRarity(badge: BadgeRarityInput, now: Date = new Date()): BadgeRarity {
  const holders = badge.holders ?? 0;
  const eligible = badge.eligible ?? 0;

  if (holders === 0 || eligible <= 0) return difficultyRarity(badge);

  if (badge.createdAt) {
    const created = badge.createdAt instanceof Date ? badge.createdAt : new Date(badge.createdAt);
    if (now.getTime() - created.getTime() < RARITY_PROVING_PERIOD_MS) {
      return difficultyRarity(badge);
    }
  }

  const share = holders / eligible;
  if (share >= 0.5) return "Common";
  if (share >= 0.2) return "Uncommon";
  if (share >= 0.05) return "Rare";
  return "Legendary";
}

export function badgeRarityVariant(rarity: BadgeRarity): BadgeProps["variant"] {
  if (rarity === "Legendary") return "purple";
  if (rarity === "Rare") return "orange";
  if (rarity === "Uncommon") return "blue";
  return "gray";
}

export function badgeRarityMedallionClass(rarity: BadgeRarity, earned: boolean): string {
  if (!earned) {
    return "bg-muted text-muted-foreground shadow-[inset_0_0_0_1px_var(--border)]";
  }
  if (rarity === "Legendary") {
    return "bg-[var(--purple-bg)] text-[var(--purple-text)] shadow-[inset_0_0_0_1px_var(--purple-text),0_0_0_4px_var(--purple-bg)]";
  }
  if (rarity === "Rare") {
    return "bg-[var(--orange-bg)] text-[var(--orange-text)] shadow-[inset_0_0_0_1px_var(--orange-text),0_0_0_4px_var(--orange-bg)]";
  }
  if (rarity === "Uncommon") {
    return "bg-[var(--blue-bg)] text-[var(--blue-text)] shadow-[inset_0_0_0_1px_var(--blue-text),0_0_0_4px_var(--blue-bg)]";
  }
  return "bg-primary/10 text-primary shadow-[inset_0_0_0_1px_var(--primary)]";
}
