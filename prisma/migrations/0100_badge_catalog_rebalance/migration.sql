-- Badge catalog rebalance.
--
-- Live data before this migration: 33 definitions, 67 awards, 14 users. Thirteen
-- people held `first_checkout`, three held `checkout_5`, and nobody held
-- `checkout_25` or `checkout_100` -- everyone earned a handful in their first
-- week and then hit a wall. All ten curated manual badges had zero awards while
-- staff invented three custom ones instead. Shift work, half the product, earned
-- nothing at all.
--
-- Nothing is deleted. Retiring is `active = false`, so awarded rows survive and
-- still render on the profiles that hold them.

-- ── 1. Fill the gaps in the count ladders ───────────────────────────────────
-- The existing triggers already drive these; the evaluator needs no change.
INSERT INTO "badge_definitions" (
  "id", "key", "name", "description", "icon",
  "category", "kind", "trigger", "threshold", "rule_key", "active", "sort_order"
)
VALUES
  ('seed_badge_checkout_10', 'checkout_10', 'Gear Hand', 'Opened ten gear checkouts.', 'Boxes', 'CHECKOUT'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:opened', 10, NULL, true, 25),
  ('seed_badge_on_time_25', 'on_time_25', 'Dependable', 'Returned 25 checkouts on time.', 'CalendarCheck2', 'ON_TIME'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:returned', 25, 'on_time_return', true, 125),
  ('seed_badge_scan_50', 'scan_50', 'Scan Regular', 'Completed 50 successful kiosk scans.', 'ScanSearch', 'SCAN'::"BadgeCategory", 'COUNT'::"BadgeKind", 'scan:success', 50, NULL, true, 235),
  -- Returned complete and undamaged. Replaces `perfect_handoff` and
  -- `full_kit_no_misses`, which asked staff to notice this by hand.
  ('seed_badge_damage_free_10', 'damage_free_10', 'Careful Hands', 'Returned ten checkouts with nothing damaged or missing.', 'ShieldCheck', 'ON_TIME'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:returned', 10, 'damage_free_return', true, 150),
  ('seed_badge_damage_free_50', 'damage_free_50', 'Immaculate', 'Returned 50 checkouts with nothing damaged or missing.', 'BadgeCheck', 'ON_TIME'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:returned', 50, 'damage_free_return', true, 160)
ON CONFLICT ("key") DO NOTHING;

-- ── 2. Bring shift work back ────────────────────────────────────────────────
-- Retired in 0066 because attendance is not tracked. That conflated two things:
-- nobody records whether a person showed up, but the schedule durably records
-- who was committed to be there, and that commitment is what the crew is
-- recognised for. Counted nightly from assignments to events that have ended.
UPDATE "badge_definitions"
SET
  "active" = true,
  "rule_key" = NULL,
  "description" = CASE "key"
    WHEN 'first_shift' THEN 'Worked a first event shift.'
    WHEN 'shift_10' THEN 'Worked ten event shifts.'
    WHEN 'shift_50' THEN 'Worked 50 event shifts.'
    ELSE "description"
  END
WHERE "key" IN ('first_shift', 'shift_10', 'shift_50');

-- `streak_shifts_5` and `streak_shifts_10` stay retired: consecutive-ness is
-- ill-defined without attendance, and the counts carry the recognition alone.

-- ── 3. Make category_collector earnable ─────────────────────────────────────
-- It was a manual badge with zero awards. The fact it recognises -- this person
-- has worked with most of the inventory -- is already in the booking rows.
UPDATE "badge_definitions"
SET
  "kind" = 'COUNT'::"BadgeKind",
  "trigger" = 'checkout:opened',
  "threshold" = 5,
  "description" = 'Checked out gear from five different categories.'
WHERE "key" = 'category_collector';

-- ── 4. Retire the manual badges nobody awarded ──────────────────────────────
-- Zero awards each since launch. Staff reached for custom badges instead, which
-- is the manual mechanism that actually gets used. `above_and_beyond` and
-- `event_hero` stay as the two genuine catch-alls.
UPDATE "badge_definitions"
SET
  "active" = false,
  "description" = 'Retired: replaced by automatic recognition or unused in practice.'
WHERE "key" IN (
  'perfect_handoff',
  'clean_loop',
  'full_kit_no_misses',
  'semester_streak',
  'rookie_run',
  'reliable_regular',
  'clutch_cover'
);
