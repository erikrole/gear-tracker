export const automaticCheckoutRuleKeys = [
  "checkout_family_batteries",
  "checkout_family_lenses",
  "checkout_family_audio",
  "checkout_support",
  "checkout_family_lighting",
  "checkout_families_5",
  "checkout_full_rig",
  "checkout_items_15",
] as const;

export const automaticShiftRuleKeys = [
  "shift_away_completed",
  "shift_before_7",
] as const;

export const automaticMeasuredRuleKeys = new Set<string>([
  "category_collector",
  ...automaticCheckoutRuleKeys,
  ...automaticShiftRuleKeys,
]);

type CategoryEvidence = {
  id: string;
  name: string;
  parent: { name: string } | null;
} | null;

export type CheckoutBadgeEvidence = {
  serializedItems: Array<{
    asset: { category: CategoryEvidence };
  }>;
  bulkItems: Array<{
    checkedOutQuantity: number;
    bulkSku: { categoryRel: CategoryEvidence };
  }>;
};

export type ShiftBadgeEvidence = {
  callStartsAt: Date | null;
  shift: {
    startsAt: Date;
    callStartsAt: Date | null;
    shiftGroup: {
      event: { isHome: boolean | null };
    };
  };
};

function increment(counts: Map<string, number>, ruleKey: string) {
  counts.set(ruleKey, (counts.get(ruleKey) ?? 0) + 1);
}

function normalizedFamily(category: CategoryEvidence) {
  return (category?.parent?.name ?? category?.name ?? "").trim().toLowerCase();
}

/**
 * Counts only checkouts whose credit was frozen by an immutable event receipt.
 * Bulk items qualify only when at least one piece was actually handed out.
 */
export function checkoutAutomaticRuleCounts(bookings: CheckoutBadgeEvidence[]) {
  const counts = new Map<string, number>();
  const distinctCategoryIds = new Set<string>();

  for (const booking of bookings) {
    const serializedCategories = booking.serializedItems.map((item) => item.asset.category);
    const checkedOutBulkItems = booking.bulkItems.filter((item) => item.checkedOutQuantity > 0);
    const bulkCategories = checkedOutBulkItems.map((item) => item.bulkSku.categoryRel);
    const categories = [...serializedCategories, ...bulkCategories];
    const families = new Set(categories.map(normalizedFamily).filter(Boolean));

    for (const category of categories) {
      if (category?.id) distinctCategoryIds.add(category.id);
    }

    if (families.has("batteries")) increment(counts, "checkout_family_batteries");
    if (families.has("lenses")) increment(counts, "checkout_family_lenses");
    if (families.has("audio")) increment(counts, "checkout_family_audio");
    if (families.has("tripods") || families.has("gimbal")) increment(counts, "checkout_support");
    if (families.has("lighting")) increment(counts, "checkout_family_lighting");
    if (families.size >= 5) increment(counts, "checkout_families_5");
    if (families.has("cameras") && families.has("lenses") && families.has("audio")) {
      increment(counts, "checkout_full_rig");
    }

    const itemCount = booking.serializedItems.length
      + checkedOutBulkItems.reduce((total, item) => total + item.checkedOutQuantity, 0);
    if (itemCount >= 15) increment(counts, "checkout_items_15");
  }

  counts.set("category_collector", distinctCategoryIds.size);
  return counts;
}

function localHour(date: Date, timeZone: string) {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).find((part) => part.type === "hour")?.value;
  return Number(hour ?? -1);
}

export function shiftAutomaticRuleCounts(assignments: ShiftBadgeEvidence[], timeZone: string) {
  const counts = new Map<string, number>();

  for (const assignment of assignments) {
    if (assignment.shift.shiftGroup.event.isHome === false) {
      increment(counts, "shift_away_completed");
    }

    const effectiveStart = assignment.callStartsAt
      ?? assignment.shift.callStartsAt
      ?? assignment.shift.startsAt;
    const hour = localHour(effectiveStart, timeZone);
    if (hour >= 0 && hour < 7) increment(counts, "shift_before_7");
  }

  return counts;
}
