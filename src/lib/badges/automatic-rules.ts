export const automaticCheckoutRuleKeys = [
  "checkout_family_batteries",
  "checkout_family_lenses",
  "checkout_family_audio",
  "checkout_support",
  "checkout_family_lighting",
  "checkout_families_5",
  "checkout_full_rig",
  "checkout_items_15",
  "checkout_distinct_assets",
  "checkout_weeks",
  "checkout_from_kit",
  "checkout_same_asset",
  "checkout_batteries_only",
] as const;

export const automaticTradeRuleKeys = [
  "trade_short_notice",
] as const;

export const automaticReturnRuleKeys = [
  "return_long_haul",
  "return_same_day",
  "return_buzzer_beater",
] as const;

export const automaticShiftRuleKeys = [
  "shift_away_completed",
  "shift_before_7",
  "shift_sports",
  "shift_areas",
  "shift_doubleheader_days",
  "shift_after_22",
] as const;

export const automaticMeasuredRuleKeys = new Set<string>([
  "category_collector",
  ...automaticCheckoutRuleKeys,
  ...automaticReturnRuleKeys,
  ...automaticTradeRuleKeys,
  ...automaticShiftRuleKeys,
]);

/** A checkout held at least this long is a long-haul custody. */
const LONG_HAUL_MS = 7 * 24 * 60 * 60 * 1000;

/** How close to the due moment a return has to land to count as a buzzer beater. */
const BUZZER_WINDOW_MS = 5 * 60 * 1000;

/** A claim inside this window before the shift starts is short-notice cover. */
const SHORT_NOTICE_MS = 24 * 60 * 60 * 1000;

type CategoryEvidence = {
  id: string;
  name: string;
  parent: { name: string } | null;
} | null;

export type CheckoutBadgeEvidence = {
  startsAt: Date;
  kitId: string | null;
  serializedItems: Array<{
    assetId: string;
    asset: { category: CategoryEvidence };
  }>;
  bulkItems: Array<{
    checkedOutQuantity: number;
    bulkSku: { categoryRel: CategoryEvidence };
  }>;
};

export type ReturnBadgeEvidence = {
  startsAt: Date;
  endsAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  /** At most one row is needed; presence is what decides a clean return. */
  checkinReports: Array<{ id: string }>;
};

export type TradeBadgeEvidence = {
  claimedByUserId: string | null;
  claimedAt: Date | null;
  shiftAssignment: { shift: { startsAt: Date } };
};

export type ShiftBadgeEvidence = {
  callStartsAt: Date | null;
  callEndsAt: Date | null;
  shift: {
    startsAt: Date;
    endsAt: Date;
    callStartsAt: Date | null;
    callEndsAt: Date | null;
    area: string;
    shiftGroup: {
      event: { isHome: boolean | null; sportCode: string | null };
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
export function checkoutAutomaticRuleCounts(bookings: CheckoutBadgeEvidence[], timeZone: string) {
  const counts = new Map<string, number>();
  const distinctCategoryIds = new Set<string>();
  const distinctAssetIds = new Set<string>();
  const checkoutsByAssetId = new Map<string, number>();
  const weekKeys = new Set<string>();
  counts.set("checkout_from_kit", 0);
  counts.set("checkout_batteries_only", 0);

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

    if (booking.kitId) increment(counts, "checkout_from_kit");
    // An empty family set means nothing identifiable was handed out, which is
    // not the same thing as a battery run.
    if (families.size === 1 && families.has("batteries")) increment(counts, "checkout_batteries_only");

    weekKeys.add(localWeekKey(booking.startsAt, timeZone));

    for (const assetId of new Set(booking.serializedItems.map((item) => item.assetId))) {
      distinctAssetIds.add(assetId);
      checkoutsByAssetId.set(assetId, (checkoutsByAssetId.get(assetId) ?? 0) + 1);
    }
  }

  counts.set("category_collector", distinctCategoryIds.size);
  counts.set("checkout_distinct_assets", distinctAssetIds.size);
  counts.set("checkout_weeks", weekKeys.size);
  counts.set("checkout_same_asset", Math.max(0, ...checkoutsByAssetId.values()));
  return counts;
}

/**
 * Recognition read from the return moment itself rather than from a count of
 * returns. All three run before the on-time early return in the evaluator: a
 * long custody and a same-day turnaround are true whether or not the gear came
 * back on time.
 */
export function returnAutomaticRuleCounts(bookings: ReturnBadgeEvidence[], timeZone: string) {
  const counts = new Map<string, number>();
  counts.set("return_long_haul", 0);
  counts.set("return_same_day", 0);
  counts.set("return_buzzer_beater", 0);

  for (const booking of bookings) {
    const completedAt = booking.completedAt ?? booking.updatedAt;
    const heldMs = completedAt.getTime() - booking.startsAt.getTime();

    if (heldMs >= LONG_HAUL_MS && booking.checkinReports.length === 0) {
      increment(counts, "return_long_haul");
    }

    if (localParts(booking.startsAt, timeZone).date === localParts(completedAt, timeZone).date) {
      increment(counts, "return_same_day");
    }

    // Strictly at or before the due moment. The 15-minute on-time grace makes a
    // late return forgivable; it does not make it a buzzer beater.
    const msToSpare = booking.endsAt.getTime() - completedAt.getTime();
    if (msToSpare >= 0 && msToSpare <= BUZZER_WINDOW_MS) {
      increment(counts, "return_buzzer_beater");
    }
  }

  return counts;
}

/**
 * Recognition for picking a shift up late, credited to the person who claimed
 * it rather than to the person who posted it.
 *
 * A claim recorded at or after the shift start is not counted. It usually means
 * the trade was written down after the fact, and the system cannot tell that
 * apart from someone actually stepping in mid-shift.
 */
export function tradeAutomaticRuleCounts(trades: TradeBadgeEvidence[], userId: string) {
  const counts = new Map<string, number>();
  counts.set("trade_short_notice", 0);

  for (const trade of trades) {
    if (trade.claimedByUserId !== userId || !trade.claimedAt) continue;

    const noticeMs = trade.shiftAssignment.shift.startsAt.getTime() - trade.claimedAt.getTime();
    if (noticeMs >= 0 && noticeMs <= SHORT_NOTICE_MS) increment(counts, "trade_short_notice");
  }

  return counts;
}

/**
 * Monday-anchored week key in institution time. Derived from the local date
 * rather than from UTC, so a Sunday-night checkout is not filed under the
 * following week.
 */
function localWeekKey(date: Date, timeZone: string) {
  const [year = 1970, month = 1, day = 1] = localParts(date, timeZone).date.split("-").map(Number);
  const anchor = new Date(Date.UTC(year, month - 1, day, 12));
  const weekday = (anchor.getUTCDay() + 6) % 7;
  anchor.setUTCDate(anchor.getUTCDate() - weekday);
  return anchor.toISOString().slice(0, 10);
}

function localParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    hour: Number(value("hour") || -1),
  };
}

export function shiftAutomaticRuleCounts(assignments: ShiftBadgeEvidence[], timeZone: string) {
  const counts = new Map<string, number>();
  const sportCodes = new Set<string>();
  const areas = new Set<string>();
  const assignmentsByLocalDate = new Map<string, number>();
  // Seeded so the four breadth rules always report a number. The profile reads
  // progress from this map, and an absent key would render an unknowable goal
  // rather than 0 of 5.
  counts.set("shift_after_22", 0);

  for (const assignment of assignments) {
    if (assignment.shift.shiftGroup.event.isHome === false) {
      increment(counts, "shift_away_completed");
    }

    const effectiveStart = assignment.callStartsAt
      ?? assignment.shift.callStartsAt
      ?? assignment.shift.startsAt;
    const start = localParts(effectiveStart, timeZone);
    if (start.hour >= 0 && start.hour < 7) increment(counts, "shift_before_7");

    const sportCode = assignment.shift.shiftGroup.event.sportCode?.trim();
    if (sportCode) sportCodes.add(sportCode.toLowerCase());
    if (assignment.shift.area) areas.add(assignment.shift.area);

    assignmentsByLocalDate.set(start.date, (assignmentsByLocalDate.get(start.date) ?? 0) + 1);

    // A shift that crossed local midnight was necessarily still running during
    // the 11 p.m. hour, so it counts without its end hour reaching 22.
    const effectiveEnd = assignment.callEndsAt
      ?? assignment.shift.callEndsAt
      ?? assignment.shift.endsAt;
    if (effectiveEnd) {
      const end = localParts(effectiveEnd, timeZone);
      if (end.hour >= 22 || end.date > start.date) increment(counts, "shift_after_22");
    }
  }

  counts.set("shift_sports", sportCodes.size);
  counts.set("shift_areas", areas.size);
  counts.set(
    "shift_doubleheader_days",
    [...assignmentsByLocalDate.values()].filter((total) => total >= 2).length,
  );

  return counts;
}
