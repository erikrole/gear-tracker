-- Fifty additional automatic badges. The catalog intentionally stays on the
-- existing durable event boundary: checkout opened, checkout returned,
-- completed schedule assignment, or authenticated app open. Schedule rules
-- use the confirmed event fields already captured by CalendarEvent.

INSERT INTO "badge_definitions" (
  "id", "key", "name", "description", "icon",
  "category", "kind", "trigger", "threshold", "rule_key", "active", "sort_order"
)
VALUES
  ('seed_badge_checkout_sprint', 'checkout_sprint', 'Burst Mode', 'Opened five gear checkouts in one local calendar week.', 'PackageCheck', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:opened', 5, 'checkout_week_burst', true, 1000),
  ('seed_badge_checkout_calendar', 'checkout_calendar', 'Calendar Commitment', 'Opened checkouts in 12 different local calendar months.', 'CalendarRange', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:opened', 12, 'checkout_months', true, 1010),
  ('seed_badge_on_time_clean', 'on_time_clean', 'Clean Timing', 'Returned 20 checkouts on time with no check-in reports.', 'ShieldCheck', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:returned', 20, 'return_on_time_clean', true, 1020),
  ('seed_badge_return_steady', 'return_steady', 'Steady Hands', 'Returned 15 consecutive checkouts on time and report-free.', 'Flame', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:returned', 15, 'return_clean_streak', true, 1030),
  ('seed_badge_category_combo', 'category_combo', 'Category Crossfade', 'Opened three checkouts spanning at least four item categories each.', 'LayoutGrid', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:opened', 3, 'checkout_categories_4', true, 1040),
  ('seed_badge_return_no_intervention', 'return_no_intervention', 'No Follow-Ups', 'Returned 25 checkouts with no reports and no due-date changes.', 'BadgeCheck', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:returned', 25, 'return_no_intervention', true, 1050),
  ('seed_badge_shift_cross_training', 'shift_cross_training', 'Cross-Trained', 'Covered eight distinct sport-and-crew-area combinations.', 'Shuffle', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'shift:completed', 8, 'shift_sport_area_pairs', true, 1060),
  ('seed_badge_shift_schedule_span', 'shift_schedule_span', 'Calendar Crew', 'Was assigned to completed shifts in six different local months.', 'CalendarRange', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'shift:completed', 6, 'shift_months', true, 1070),
  ('seed_badge_trade_two_way', 'trade_two_way', 'Two-Way Teammate', 'Completed trades both as a poster and as a claimant.', 'Handshake', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'trade:completed', 1, 'trade_both_sides', true, 1080),
  ('seed_badge_family_archivist', 'family_archivist', 'Family Archivist', 'Checked out gear from eight different gear families.', 'Warehouse', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:opened', 8, 'checkout_distinct_families', true, 1090),
  ('seed_badge_battery_bank', 'battery_bank', 'Battery Bank', 'Checked out gear with batteries 25 times.', 'BatteryCharging', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:opened', 25, 'checkout_family_batteries', true, 1100),
  ('seed_badge_lens_library', 'lens_library', 'Lens Library', 'Checked out lenses 25 times.', 'Aperture', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:opened', 25, 'checkout_family_lenses', true, 1110),
  ('seed_badge_audio_aisle', 'audio_aisle', 'Audio Aisle', 'Checked out audio gear 15 times.', 'AudioLines', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:opened', 15, 'checkout_family_audio', true, 1120),
  ('seed_badge_lighting_grid', 'lighting_grid', 'Lighting Grid', 'Checked out lighting gear ten times.', 'Lightbulb', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:opened', 10, 'checkout_family_lighting', true, 1130),
  ('seed_badge_family_mixer', 'family_mixer', 'Family Mixer', 'Opened five checkouts spanning five or more gear families.', 'LayoutGrid', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:opened', 5, 'checkout_families_5', true, 1140),
  ('seed_badge_full_rig_heavy', 'full_rig_heavy', 'Full Rig, Full Load', 'Opened three full-rig checkouts carrying at least ten pieces each.', 'Combine', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:opened', 3, 'checkout_full_rig_heavy', true, 1150),
  ('seed_badge_gear_volume_150', 'gear_volume_150', 'Warehouse Shift', 'Moved 150 actual gear pieces through credited checkouts.', 'Dumbbell', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:opened', 150, 'checkout_item_volume', true, 1160),
  ('seed_badge_mixed_inventory', 'mixed_inventory', 'Mixed Inventory', 'Opened five checkouts containing both serialized and bulk gear.', 'Boxes', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:opened', 5, 'checkout_mixed_inventory', true, 1170),
  ('seed_badge_kit_variety', 'kit_variety', 'Kit Collector', 'Opened checkouts built from three different saved kits.', 'PackageOpen', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:opened', 3, 'checkout_distinct_kits', true, 1180),
  ('seed_badge_checkout_month_streak', 'checkout_month_streak', 'Month-to-Month', 'Opened checkouts in four consecutive local calendar months.', 'CalendarCheck2', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:opened', 4, 'checkout_consecutive_months', true, 1190),
  ('seed_badge_home_and_away', 'home_and_away', 'Home and Away', 'Was assigned to both home and away completed events.', 'Ticket', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'shift:completed', 1, 'shift_home_and_away', true, 1200),
  ('seed_badge_schedule_spectrum', 'schedule_spectrum', 'Schedule Spectrum', 'Covered at least five sports across at least three crew areas.', 'Shuffle', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'shift:completed', 1, 'shift_spectrum', true, 1210),
  ('seed_badge_away_win', 'away_win', 'Road Win', 'Was assigned to three completed away events recorded as wins.', 'Trophy', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'shift:completed', 3, 'shift_away_wins', true, 1220),
  ('seed_badge_result_site_sweep', 'result_site_sweep', 'Three-Site Scoreboard', 'Worked recorded wins at home, away, and a neutral site.', 'Trophy', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'shift:completed', 1, 'shift_result_sites', true, 1230),
  ('seed_badge_long_day_crew', 'long_day_crew', 'Long-Day Crew', 'Had at least three early calls and five late finishes.', 'Sunset', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'shift:completed', 1, 'shift_early_late_mix', true, 1240),
  ('seed_badge_reservation_event', 'reservation_event', 'Reserved for Game Day', 'Opened three reservation checkouts tied to scheduled events.', 'CalendarClock', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:opened', 3, 'checkout_reserved_event', true, 1250),
  ('seed_badge_distinct_event_loadout', 'distinct_event_loadout', 'Event Roster', 'Opened credited checkouts linked to ten distinct scheduled events.', 'CalendarCheck2', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:opened', 10, 'checkout_distinct_events', true, 1260),
  ('seed_badge_multi_event', 'multi_event', 'Multi-Event Loadout', 'Opened five checkouts linked to two or more scheduled events.', 'Combine', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:opened', 5, 'checkout_multiple_events', true, 1270),
  ('seed_badge_full_context_loadout', 'full_context_loadout', 'Full Context Loadout', 'Opened three checkouts tied to a reservation, event, and crew assignment.', 'Cable', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:opened', 3, 'checkout_full_context', true, 1280),
  ('seed_badge_shift_loadout_heavy', 'shift_loadout_heavy', 'Crew Loadout Pro', 'Opened three shift-linked checkouts carrying at least ten pieces each.', 'PackageCheck', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:opened', 3, 'checkout_for_shift_heavy', true, 1290),
  ('seed_badge_result_sweep', 'result_sweep', 'Scoreboard Across Sports', 'Worked events with recorded results in four different sports.', 'BadgeCheck', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'shift:completed', 4, 'shift_scored_sports', true, 1300),
  ('seed_badge_winning_record', 'winning_record', 'Winning Record', 'Worked at least eight decided events with more wins than losses.', 'Trophy', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'shift:completed', 1, 'shift_winning_record', true, 1310),
  ('seed_badge_win_streak', 'win_streak', 'Hot Streak', 'Worked five consecutive events recorded as wins.', 'Flame', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'shift:completed', 5, 'shift_win_streak', true, 1320),
  ('seed_badge_bounce_back', 'bounce_back', 'Bounce Back', 'Worked a recorded win after a recorded loss.', 'Repeat2', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'shift:completed', 1, 'shift_bounce_back', true, 1330),
  ('seed_badge_battle_tested', 'battle_tested', 'Battle Tested', 'Worked at least three wins and three losses across the schedule.', 'ShieldCheck', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'shift:completed', 1, 'shift_battle_tested', true, 1340),
  ('seed_badge_home_field', 'home_field', 'Home Field', 'Was assigned to 15 completed events at a recorded home site.', 'Ticket', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'shift:completed', 15, 'shift_home', true, 1350),
  ('seed_badge_neutral_ground', 'neutral_ground', 'Neutral Ground', 'Was assigned to five completed neutral-site events.', 'Binoculars', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'shift:completed', 5, 'shift_neutral', true, 1360),
  ('seed_badge_venue_hopper', 'venue_hopper', 'Venue Hopper', 'Was assigned to completed events at seven different mapped venues.', 'Warehouse', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'shift:completed', 7, 'shift_venues', true, 1370),
  ('seed_badge_venue_regular', 'venue_regular', 'Venue Regular', 'Was assigned to 15 completed events at the same mapped venue.', 'ShoppingCart', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'shift:completed', 15, 'shift_same_venue', true, 1380),
  ('seed_badge_opponent_rollcall', 'opponent_rollcall', 'Opponent Rollcall', 'Was assigned to completed events against seven different opponents.', 'Handshake', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'shift:completed', 7, 'shift_opponents', true, 1390),
  ('seed_badge_rivalry_rematch', 'rivalry_rematch', 'Rivalry Rematch', 'Was assigned to five completed events against the same opponent.', 'Repeat2', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'shift:completed', 5, 'shift_same_opponent', true, 1400),
  ('seed_badge_site_sweep', 'site_sweep', 'Three-Site Tour', 'Was assigned to home, away, and neutral completed events.', 'Binoculars', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'shift:completed', 3, 'shift_sites', true, 1410),
  ('seed_badge_oops_damaged', 'oops_damaged', 'Oops, That Was Damaged', 'Returned a checkout with a recorded damage report. It happens.', 'CloudRain', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:returned', 1, 'return_damaged', true, 1420),
  ('seed_badge_oops_missing', 'oops_missing', 'Where Did That Go?', 'Returned a checkout with a recorded missing-item report.', 'ShoppingCart', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:returned', 1, 'return_missing', true, 1430),
  ('seed_badge_running_late', 'running_late', 'Running Late', 'Returned five checkouts more than 15 minutes after they were due.', 'AlarmClock', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:returned', 5, 'return_late', true, 1440),
  ('seed_badge_due_date_dancer', 'due_date_dancer', 'Due Date Dancer', 'Had the due date changed on three completed checkouts.', 'CalendarClock', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:returned', 3, 'return_due_date_changed', true, 1450),
  ('seed_badge_calendar_tetris', 'calendar_tetris', 'Calendar Tetris', 'Was assigned to five completed shifts that carried a recorded conflict.', 'CalendarDays', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'shift:completed', 5, 'shift_conflicts', true, 1460),
  ('seed_badge_midnight_oil', 'midnight_oil', 'Midnight Oil', 'Opened the app during the midnight hour.', 'MoonStar', 'MILESTONE'::"BadgeCategory", 'RULE'::"BadgeKind", 'app:opened', NULL, 'local_hour_0', true, 1470),
  ('seed_badge_weekend_warrior', 'weekend_warrior', 'Weekend Warrior', 'Opened the app on a Saturday or Sunday.', 'Sparkles', 'MILESTONE'::"BadgeCategory", 'RULE'::"BadgeKind", 'app:opened', NULL, 'local_weekend', true, 1480),
  ('seed_badge_leap_day', 'leap_day', 'Leap Day', 'Opened the app on February 29.', 'Clapperboard', 'MILESTONE'::"BadgeCategory", 'RULE'::"BadgeKind", 'app:opened', NULL, 'local_leap_day', true, 1490)
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "icon" = EXCLUDED."icon",
  "category" = EXCLUDED."category",
  "kind" = EXCLUDED."kind",
  "trigger" = EXCLUDED."trigger",
  "threshold" = EXCLUDED."threshold",
  "rule_key" = EXCLUDED."rule_key",
  "active" = EXCLUDED."active",
  "sort_order" = EXCLUDED."sort_order";

-- Repair simple volume ladders from the same event scopes as the evaluator.
WITH checkout_totals AS (
  SELECT "user_id", COUNT(*)::int AS total
  FROM "badge_event_receipts"
  WHERE "event_type" = 'checkout_opened'
  GROUP BY "user_id"
)
INSERT INTO "student_badges" ("id", "user_id", "definition_id")
SELECT 'badge_backfill_' || md5(c."user_id" || ':' || d."id"), c."user_id", d."id"
FROM checkout_totals c
JOIN "badge_definitions" d
  ON d."active" = true
  AND d."category" = 'CHECKOUT'::"BadgeCategory"
  AND d."trigger" = 'checkout:opened'
  AND d."rule_key" IS NULL
  AND d."threshold" <= c.total
ON CONFLICT ("user_id", "definition_id") DO NOTHING;

WITH shift_totals AS (
  SELECT sa."user_id", COUNT(*)::int AS total
  FROM "shift_assignments" sa
  JOIN "shifts" s ON s."id" = sa."shift_id"
  JOIN "shift_groups" sg ON sg."id" = s."shift_group_id"
  JOIN "calendar_events" e ON e."id" = sg."event_id"
  WHERE sa."status" IN ('DIRECT_ASSIGNED'::"ShiftAssignmentStatus", 'APPROVED'::"ShiftAssignmentStatus")
    AND e."status" = 'CONFIRMED'::"CalendarEventStatus"
    AND e."ends_at" < CURRENT_TIMESTAMP
  GROUP BY sa."user_id"
)
INSERT INTO "student_badges" ("id", "user_id", "definition_id")
SELECT 'badge_backfill_' || md5(c."user_id" || ':' || d."id"), c."user_id", d."id"
FROM shift_totals c
JOIN "badge_definitions" d
  ON d."active" = true
  AND d."category" = 'SHIFT'::"BadgeCategory"
  AND d."trigger" = 'shift:completed'
  AND d."rule_key" IS NULL
  AND d."threshold" <= c.total
ON CONFLICT ("user_id", "definition_id") DO NOTHING;

WITH trade_totals AS (
  SELECT u."id" AS user_id, COUNT(*)::int AS total
  FROM "users" u
  JOIN "shift_trades" t
    ON t."status" = 'COMPLETED'::"ShiftTradeStatus"
   AND (t."posted_by_user_id" = u."id" OR t."claimed_by_user_id" = u."id")
  GROUP BY u."id"
)
INSERT INTO "student_badges" ("id", "user_id", "definition_id")
SELECT 'badge_backfill_' || md5(c.user_id || ':' || d."id"), c.user_id, d."id"
FROM trade_totals c
JOIN "badge_definitions" d
  ON d."active" = true
  AND d."category" = 'TRADE'::"BadgeCategory"
  AND d."trigger" = 'trade:completed'
  AND d."rule_key" IS NULL
  AND d."threshold" <= c.total
ON CONFLICT ("user_id", "definition_id") DO NOTHING;

WITH trade_roles AS (
  SELECT
    u."id" AS user_id,
    BOOL_OR(t."posted_by_user_id" = u."id") AS posted,
    BOOL_OR(t."claimed_by_user_id" = u."id") AS claimed
  FROM "users" u
  JOIN "shift_trades" t
    ON t."status" = 'COMPLETED'::"ShiftTradeStatus"
   AND (t."posted_by_user_id" = u."id" OR t."claimed_by_user_id" = u."id")
  GROUP BY u."id"
)
INSERT INTO "student_badges" ("id", "user_id", "definition_id")
SELECT 'badge_backfill_' || md5(r.user_id || ':' || d."id"), r.user_id, d."id"
FROM trade_roles r
JOIN "badge_definitions" d
  ON d."active" = true
  AND d."trigger" = 'trade:completed'
  AND d."rule_key" = 'trade_both_sides'
  AND d."threshold" <= 1
WHERE r.posted AND r.claimed
ON CONFLICT ("user_id", "definition_id") DO NOTHING;

-- Return counters and problem-return recognition are all derived from the
-- current custodian's completed checkout rows. The grace window matches the
-- on-time evaluator; a return after that window is a real late-return fact.
WITH completed_returns AS (
  SELECT
    b."requester_user_id" AS user_id,
    b."id" AS booking_id,
    b."starts_at",
    b."ends_at",
    COALESCE(b."completed_at", b."updated_at") AS returned_at,
    EXISTS (SELECT 1 FROM "checkin_item_reports" r WHERE r."booking_id" = b."id") AS has_reports,
    EXISTS (SELECT 1 FROM "checkin_item_reports" r WHERE r."booking_id" = b."id" AND r."type" = 'DAMAGED'::"CheckinReportType") AS has_damage,
    EXISTS (SELECT 1 FROM "checkin_item_reports" r WHERE r."booking_id" = b."id" AND r."type" = 'LOST'::"CheckinReportType") AS has_missing,
    EXISTS (SELECT 1 FROM "booking_due_date_changes" d WHERE d."booking_id" = b."id") AS due_date_changed
  FROM "bookings" b
  WHERE b."kind" = 'CHECKOUT'::"BookingKind"
    AND b."status" = 'COMPLETED'::"BookingStatus"
), return_sequence AS (
  SELECT
    c.*,
    CASE
      WHEN c.returned_at <= c."ends_at" + INTERVAL '15 minutes' AND c.has_reports = false THEN 1
      ELSE 0
    END AS is_clean_on_time,
    SUM(
      CASE
        WHEN c.returned_at <= c."ends_at" + INTERVAL '15 minutes' AND c.has_reports = false THEN 0
        ELSE 1
      END
    ) OVER (PARTITION BY c.user_id ORDER BY c.returned_at, c.booking_id) AS break_group
  FROM completed_returns c
), return_clean_streaks AS (
  SELECT user_id, MAX(streak)::int AS total
  FROM (
    SELECT user_id, break_group, COUNT(*) FILTER (WHERE is_clean_on_time = 1)::int AS streak
    FROM return_sequence
    GROUP BY user_id, break_group
  ) grouped
  GROUP BY user_id
), return_rule_counts AS (
  SELECT c.user_id, 'on_time_return' AS rule_key, COUNT(*)::int AS total
  FROM completed_returns c
  WHERE c.returned_at <= c."ends_at" + INTERVAL '15 minutes'
  GROUP BY c.user_id
  UNION ALL
  SELECT c.user_id, 'damage_free_return', COUNT(*)::int
  FROM completed_returns c
  WHERE c.has_reports = false
  GROUP BY c.user_id
  UNION ALL
  SELECT c.user_id, 'return_long_haul', COUNT(*)::int
  FROM completed_returns c
  WHERE c.returned_at - c."starts_at" >= INTERVAL '7 days' AND c.has_reports = false
  GROUP BY c.user_id
  UNION ALL
  SELECT c.user_id, 'return_same_day', COUNT(*)::int
  FROM completed_returns c
  WHERE (c."starts_at" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')::date
      = (c.returned_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')::date
  GROUP BY c.user_id
  UNION ALL
  SELECT c.user_id, 'return_buzzer_beater', COUNT(*)::int
  FROM completed_returns c
  WHERE c.returned_at <= c."ends_at"
    AND c.returned_at >= c."ends_at" - INTERVAL '5 minutes'
  GROUP BY c.user_id
  UNION ALL
  SELECT c.user_id, 'return_reported', COUNT(*)::int
  FROM completed_returns c
  WHERE c.has_reports
  GROUP BY c.user_id
  UNION ALL
  SELECT c.user_id, 'return_damaged', COUNT(*)::int
  FROM completed_returns c
  WHERE c.has_damage
  GROUP BY c.user_id
  UNION ALL
  SELECT c.user_id, 'return_missing', COUNT(*)::int
  FROM completed_returns c
  WHERE c.has_missing
  GROUP BY c.user_id
  UNION ALL
  SELECT c.user_id, 'return_late', COUNT(*)::int
  FROM completed_returns c
  WHERE c.returned_at > c."ends_at" + INTERVAL '15 minutes'
  GROUP BY c.user_id
  UNION ALL
  SELECT c.user_id, 'return_due_date_changed', COUNT(*)::int
  FROM completed_returns c
  WHERE c.due_date_changed
  GROUP BY c.user_id
  UNION ALL
  SELECT c.user_id, 'return_on_time_clean', COUNT(*)::int
  FROM completed_returns c
  WHERE c.returned_at <= c."ends_at" + INTERVAL '15 minutes' AND c.has_reports = false
  GROUP BY c.user_id
  UNION ALL
  SELECT c.user_id, 'return_no_intervention', COUNT(*)::int
  FROM completed_returns c
  WHERE c.has_reports = false AND c.due_date_changed = false
  GROUP BY c.user_id
  UNION ALL
  SELECT s.user_id, 'return_clean_streak', s.total
  FROM return_clean_streaks s
)
INSERT INTO "student_badges" ("id", "user_id", "definition_id")
SELECT 'badge_backfill_' || md5(c.user_id || ':' || d."id"), c.user_id, d."id"
FROM return_rule_counts c
JOIN "badge_definitions" d
  ON d."active" = true
  AND d."trigger" = 'checkout:returned'
  AND d."rule_key" = c.rule_key
  AND d."threshold" <= c.total
ON CONFLICT ("user_id", "definition_id") DO NOTHING;

-- Preserve a completed on-time streak when a new threshold definition is
-- introduced after the streak state already exists.
INSERT INTO "student_badges" ("id", "user_id", "definition_id")
SELECT 'badge_backfill_' || md5(s."user_id" || ':' || d."id"), s."user_id", d."id"
FROM "badge_streaks" s
JOIN "badge_definitions" d
  ON d."active" = true
  AND d."trigger" = 'checkout:returned'
  AND d."rule_key" = 'on_time_return_streak'
  AND d."threshold" <= s."current"
WHERE s."streak_type" = 'ON_TIME_RETURN'::"BadgeStreakType"
ON CONFLICT ("user_id", "definition_id") DO NOTHING;

-- Checkout breadth and event-context rules read credited receipts, never the
-- requester's current ownership. The category/family shape mirrors the
-- evaluator, including actual handed-out bulk quantity.
WITH credited_bookings AS (
  SELECT
    r."user_id",
    b."id" AS booking_id,
    b."starts_at",
    b."kit_id",
    b."event_id",
    b."source_reservation_id",
    b."shift_assignment_id"
  FROM "badge_event_receipts" r
  JOIN "bookings" b ON b."id" = r."source_key"
  WHERE r."event_type" = 'checkout_opened'
    AND b."kind" = 'CHECKOUT'::"BookingKind"
    AND b."status" IN ('OPEN'::"BookingStatus", 'COMPLETED'::"BookingStatus")
), credited_assets AS (
  SELECT DISTINCT c."user_id", c.booking_id, i."asset_id"
  FROM credited_bookings c
  JOIN "booking_serialized_items" i ON i."booking_id" = c.booking_id
), credited_categories AS (
  SELECT DISTINCT c."user_id", c.booking_id, a."category_id" AS category_id
  FROM credited_bookings c
  JOIN "booking_serialized_items" i ON i."booking_id" = c.booking_id
  JOIN "assets" a ON a."id" = i."asset_id"
  WHERE a."category_id" IS NOT NULL
  UNION
  SELECT DISTINCT c."user_id", c.booking_id, s."category_id"
  FROM credited_bookings c
  JOIN "booking_bulk_items" i ON i."booking_id" = c.booking_id
  JOIN "bulk_skus" s ON s."id" = i."bulk_sku_id"
  WHERE i."checked_out_quantity" > 0 AND s."category_id" IS NOT NULL
), credited_families AS (
  SELECT DISTINCT c."user_id", c.booking_id, LOWER(BTRIM(COALESCE(parent."name", category."name"))) AS family_name
  FROM credited_bookings c
  JOIN "booking_serialized_items" i ON i."booking_id" = c.booking_id
  JOIN "assets" a ON a."id" = i."asset_id"
  JOIN "categories" category ON category."id" = a."category_id"
  LEFT JOIN "categories" parent ON parent."id" = category."parent_id"
  UNION
  SELECT DISTINCT c."user_id", c.booking_id, LOWER(BTRIM(COALESCE(parent."name", category."name")))
  FROM credited_bookings c
  JOIN "booking_bulk_items" i ON i."booking_id" = c.booking_id
  JOIN "bulk_skus" s ON s."id" = i."bulk_sku_id"
  JOIN "categories" category ON category."id" = s."category_id"
  LEFT JOIN "categories" parent ON parent."id" = category."parent_id"
  WHERE i."checked_out_quantity" > 0
), family_stats AS (
  SELECT
    f."user_id",
    f.booking_id,
    COUNT(*)::int AS family_count,
    BOOL_OR(f.family_name = 'batteries') AS has_batteries,
    BOOL_OR(f.family_name = 'lenses') AS has_lenses,
    BOOL_OR(f.family_name = 'audio') AS has_audio,
    BOOL_OR(f.family_name = 'cameras') AS has_cameras,
    BOOL_OR(f.family_name = 'tripods' OR f.family_name = 'gimbal') AS has_support,
    BOOL_OR(f.family_name = 'lighting') AS has_lighting
  FROM credited_families f
  GROUP BY f."user_id", f.booking_id
), item_counts AS (
  SELECT
    c."user_id",
    c.booking_id,
    (SELECT COUNT(*) FROM "booking_serialized_items" i WHERE i."booking_id" = c.booking_id) AS serialized_count,
    (SELECT COALESCE(SUM(i."checked_out_quantity"), 0) FROM "booking_bulk_items" i WHERE i."booking_id" = c.booking_id AND i."checked_out_quantity" > 0) AS bulk_count,
    (SELECT COUNT(*) FROM "booking_serialized_items" i WHERE i."booking_id" = c.booking_id)
      + (SELECT COALESCE(SUM(i."checked_out_quantity"), 0) FROM "booking_bulk_items" i WHERE i."booking_id" = c.booking_id AND i."checked_out_quantity" > 0) AS item_count
  FROM credited_bookings c
), checkout_category_counts AS (
  SELECT c."user_id", c.booking_id, COUNT(DISTINCT c.category_id)::int AS category_count
  FROM credited_categories c
  GROUP BY c."user_id", c.booking_id
), checkout_week_counts AS (
  SELECT
    c."user_id",
    DATE_TRUNC('week', c."starts_at" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') AS week_start,
    COUNT(*)::int AS total
  FROM credited_bookings c
  GROUP BY c."user_id", week_start
), checkout_month_presence AS (
  SELECT DISTINCT
    c."user_id",
    DATE_TRUNC('month', c."starts_at" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') AS month_start
  FROM credited_bookings c
), checkout_month_groups AS (
  SELECT
    m."user_id",
    m.month_start,
    m.month_start - (ROW_NUMBER() OVER (PARTITION BY m."user_id" ORDER BY m.month_start) * INTERVAL '1 month') AS group_key
  FROM checkout_month_presence m
), checkout_month_streaks AS (
  SELECT "user_id", MAX(total)::int AS total
  FROM (
    SELECT "user_id", group_key, COUNT(*)::int AS total
    FROM checkout_month_groups
    GROUP BY "user_id", group_key
  ) grouped
  GROUP BY "user_id"
), credited_event_links AS (
  SELECT c."user_id", c.booking_id, c."event_id" AS event_id
  FROM credited_bookings c
  WHERE c."event_id" IS NOT NULL
  UNION
  SELECT c."user_id", c.booking_id, e."event_id"
  FROM credited_bookings c
  JOIN "booking_events" e ON e."booking_id" = c.booking_id
), event_stats AS (
  SELECT e."user_id", e.booking_id, COUNT(DISTINCT e.event_id)::int AS event_count
  FROM credited_event_links e
  GROUP BY e."user_id", e.booking_id
), asset_repeat_counts AS (
  SELECT a."user_id", a."asset_id", COUNT(DISTINCT a.booking_id)::int AS total
  FROM credited_assets a
  GROUP BY a."user_id", a."asset_id"
), checkout_rule_counts AS (
  SELECT c."user_id", 'category_collector' AS rule_key, COUNT(DISTINCT c.category_id)::int AS total
  FROM credited_categories c
  GROUP BY c."user_id"
  UNION ALL
  SELECT f."user_id", 'checkout_family_batteries', COUNT(*)::int
  FROM family_stats f WHERE f.has_batteries GROUP BY f."user_id"
  UNION ALL
  SELECT f."user_id", 'checkout_family_lenses', COUNT(*)::int
  FROM family_stats f WHERE f.has_lenses GROUP BY f."user_id"
  UNION ALL
  SELECT f."user_id", 'checkout_family_audio', COUNT(*)::int
  FROM family_stats f WHERE f.has_audio GROUP BY f."user_id"
  UNION ALL
  SELECT f."user_id", 'checkout_support', COUNT(*)::int
  FROM family_stats f WHERE f.has_support GROUP BY f."user_id"
  UNION ALL
  SELECT f."user_id", 'checkout_family_lighting', COUNT(*)::int
  FROM family_stats f WHERE f.has_lighting GROUP BY f."user_id"
  UNION ALL
  SELECT f."user_id", 'checkout_families_5', COUNT(*)::int
  FROM family_stats f WHERE f.family_count >= 5 GROUP BY f."user_id"
  UNION ALL
  SELECT f."user_id", 'checkout_full_rig', COUNT(*)::int
  FROM family_stats f WHERE f.has_cameras AND f.has_lenses AND f.has_audio GROUP BY f."user_id"
  UNION ALL
  SELECT i."user_id", 'checkout_items_15', COUNT(*)::int
  FROM item_counts i WHERE i.item_count >= 15 GROUP BY i."user_id"
  UNION ALL
  SELECT a."user_id", 'checkout_distinct_assets', COUNT(DISTINCT a."asset_id")::int
  FROM credited_assets a GROUP BY a."user_id"
  UNION ALL
  SELECT c."user_id", 'checkout_weeks', COUNT(DISTINCT DATE_TRUNC('week', c."starts_at" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago'))::int
  FROM credited_bookings c GROUP BY c."user_id"
  UNION ALL
  SELECT c."user_id", 'checkout_from_kit', COUNT(*)::int
  FROM credited_bookings c WHERE c."kit_id" IS NOT NULL GROUP BY c."user_id"
  UNION ALL
  SELECT r."user_id", 'checkout_same_asset', MAX(r.total)::int
  FROM asset_repeat_counts r GROUP BY r."user_id"
  UNION ALL
  SELECT f."user_id", 'checkout_batteries_only', COUNT(*)::int
  FROM family_stats f WHERE f.family_count = 1 AND f.has_batteries GROUP BY f."user_id"
  UNION ALL
  SELECT e."user_id", 'checkout_event_linked', COUNT(*)::int
  FROM event_stats e WHERE e.event_count >= 1 GROUP BY e."user_id"
  UNION ALL
  SELECT e."user_id", 'checkout_multiple_events', COUNT(*)::int
  FROM event_stats e WHERE e.event_count >= 2 GROUP BY e."user_id"
  UNION ALL
  SELECT c."user_id", 'checkout_from_reservation', COUNT(*)::int
  FROM credited_bookings c WHERE c."source_reservation_id" IS NOT NULL GROUP BY c."user_id"
  UNION ALL
  SELECT c."user_id", 'checkout_for_shift', COUNT(*)::int
  FROM credited_bookings c WHERE c."shift_assignment_id" IS NOT NULL GROUP BY c."user_id"
  UNION ALL
  SELECT w."user_id", 'checkout_week_burst', MAX(w.total)::int
  FROM checkout_week_counts w GROUP BY w."user_id"
  UNION ALL
  SELECT c."user_id", 'checkout_months', COUNT(*)::int
  FROM checkout_month_presence c GROUP BY c."user_id"
  UNION ALL
  SELECT c."user_id", 'checkout_categories_4', COUNT(*)::int
  FROM checkout_category_counts c WHERE c.category_count >= 4 GROUP BY c."user_id"
  UNION ALL
  SELECT f."user_id", 'checkout_distinct_families', COUNT(DISTINCT f.family_name)::int
  FROM credited_families f
  WHERE NULLIF(f.family_name, '') IS NOT NULL
  GROUP BY f."user_id"
  UNION ALL
  SELECT f."user_id", 'checkout_full_rig_heavy', COUNT(*)::int
  FROM family_stats f
  JOIN item_counts i ON i."user_id" = f."user_id" AND i.booking_id = f.booking_id
  WHERE f.has_cameras AND f.has_lenses AND f.has_audio AND i.item_count >= 10
  GROUP BY f."user_id"
  UNION ALL
  SELECT i."user_id", 'checkout_item_volume', SUM(i.item_count)::int
  FROM item_counts i GROUP BY i."user_id"
  UNION ALL
  SELECT i."user_id", 'checkout_mixed_inventory', COUNT(*)::int
  FROM item_counts i WHERE i.serialized_count > 0 AND i.bulk_count > 0 GROUP BY i."user_id"
  UNION ALL
  SELECT c."user_id", 'checkout_distinct_kits', COUNT(DISTINCT c."kit_id")::int
  FROM credited_bookings c WHERE c."kit_id" IS NOT NULL GROUP BY c."user_id"
  UNION ALL
  SELECT s."user_id", 'checkout_consecutive_months', s.total
  FROM checkout_month_streaks s
  UNION ALL
  SELECT c."user_id", 'checkout_reserved_event', COUNT(*)::int
  FROM credited_bookings c
  JOIN event_stats e ON e."user_id" = c."user_id" AND e.booking_id = c.booking_id
  WHERE c."source_reservation_id" IS NOT NULL AND e.event_count >= 1
  GROUP BY c."user_id"
  UNION ALL
  SELECT e."user_id", 'checkout_distinct_events', COUNT(DISTINCT e.event_id)::int
  FROM credited_event_links e GROUP BY e."user_id"
  UNION ALL
  SELECT c."user_id", 'checkout_full_context', COUNT(*)::int
  FROM credited_bookings c
  JOIN event_stats e ON e."user_id" = c."user_id" AND e.booking_id = c.booking_id
  WHERE c."source_reservation_id" IS NOT NULL
    AND c."shift_assignment_id" IS NOT NULL
    AND e.event_count >= 1
  GROUP BY c."user_id"
  UNION ALL
  SELECT c."user_id", 'checkout_for_shift_heavy', COUNT(*)::int
  FROM credited_bookings c
  JOIN item_counts i ON i."user_id" = c."user_id" AND i.booking_id = c.booking_id
  WHERE c."shift_assignment_id" IS NOT NULL AND i.item_count >= 10
  GROUP BY c."user_id"
)
INSERT INTO "student_badges" ("id", "user_id", "definition_id")
SELECT 'badge_backfill_' || md5(c."user_id" || ':' || d."id"), c."user_id", d."id"
FROM checkout_rule_counts c
JOIN "badge_definitions" d
  ON d."active" = true
  AND d."trigger" = 'checkout:opened'
  AND d."rule_key" = c.rule_key
  AND d."threshold" <= c.total
ON CONFLICT ("user_id", "definition_id") DO NOTHING;

-- Schedule breadth and scoreboard rules use ended confirmed assignments. The
-- evaluator uses the same effective call window and treats mapped venue and
-- opponent strings as collections only when the source actually has them.
WITH assignment_facts AS (
  SELECT
    sa."user_id",
    sa."has_conflict",
    e."id" AS event_id,
    s."id" AS shift_id,
    e."sport_code",
    e."result",
    e."site",
    e."is_home",
    e."location_id",
    e."opponent",
    s."area",
    (
      s."starts_at" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago'
    ) AS shift_start,
    (
      COALESCE(sa."call_starts_at", s."call_starts_at", s."starts_at")
        AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago'
    ) AS local_start,
    (
      COALESCE(sa."call_ends_at", s."call_ends_at", s."ends_at")
        AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago'
    ) AS local_end
  FROM "shift_assignments" sa
  JOIN "shifts" s ON s."id" = sa."shift_id"
  JOIN "shift_groups" sg ON sg."id" = s."shift_group_id"
  JOIN "calendar_events" e ON e."id" = sg."event_id"
  WHERE sa."status" IN ('DIRECT_ASSIGNED'::"ShiftAssignmentStatus", 'APPROVED'::"ShiftAssignmentStatus")
    AND e."status" = 'CONFIRMED'::"CalendarEventStatus"
    AND e."ends_at" < CURRENT_TIMESTAMP
), doubleheader_days AS (
  SELECT f."user_id", f.local_start::date AS local_date
  FROM assignment_facts f
  GROUP BY f."user_id", f.local_start::date
  HAVING COUNT(*) >= 2
), venue_counts AS (
  SELECT f."user_id", BTRIM(f."location_id") AS location_id, COUNT(*)::int AS total
  FROM assignment_facts f
  WHERE NULLIF(BTRIM(f."location_id"), '') IS NOT NULL
  GROUP BY f."user_id", BTRIM(f."location_id")
), opponent_counts AS (
  SELECT f."user_id", LOWER(BTRIM(f."opponent")) AS opponent, COUNT(*)::int AS total
  FROM assignment_facts f
  WHERE NULLIF(BTRIM(f."opponent"), '') IS NOT NULL
  GROUP BY f."user_id", LOWER(BTRIM(f."opponent"))
), result_sequence AS (
  SELECT
    f.*,
    SUM(CASE WHEN f."result" = 'WIN'::"CalendarEventResult" THEN 0 ELSE 1 END)
      OVER (PARTITION BY f."user_id" ORDER BY f.shift_start, f.shift_id, f.event_id) AS break_group,
    MAX(CASE WHEN f."result" = 'LOSS'::"CalendarEventResult" THEN 1 ELSE 0 END)
      OVER (
        PARTITION BY f."user_id"
        ORDER BY f.shift_start, f.shift_id, f.event_id
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ) AS had_prior_loss
  FROM assignment_facts f
), win_streaks AS (
  SELECT "user_id", MAX(streak)::int AS total
  FROM (
    SELECT "user_id", break_group, COUNT(*) FILTER (WHERE "result" = 'WIN'::"CalendarEventResult")::int AS streak
    FROM result_sequence
    GROUP BY "user_id", break_group
  ) grouped
  GROUP BY "user_id"
), bounce_backs AS (
  SELECT "user_id", 1 AS total
  FROM result_sequence
  WHERE "result" = 'WIN'::"CalendarEventResult" AND had_prior_loss = 1
  GROUP BY "user_id"
), shift_summary AS (
  SELECT
    f."user_id",
    COUNT(*) FILTER (WHERE f."result" = 'WIN'::"CalendarEventResult")::int AS wins,
    COUNT(*) FILTER (WHERE f."result" = 'LOSS'::"CalendarEventResult")::int AS losses,
    COUNT(DISTINCT LOWER(BTRIM(f."sport_code"))) FILTER (WHERE NULLIF(BTRIM(f."sport_code"), '') IS NOT NULL)::int AS sports,
    COUNT(DISTINCT LOWER(BTRIM(f."area"::text))) FILTER (WHERE NULLIF(BTRIM(f."area"::text), '') IS NOT NULL)::int AS areas,
    COUNT(DISTINCT LOWER(BTRIM(f."sport_code")) || ':' || LOWER(BTRIM(f."area"::text)))
      FILTER (WHERE NULLIF(BTRIM(f."sport_code"), '') IS NOT NULL AND NULLIF(BTRIM(f."area"::text), '') IS NOT NULL)::int AS sport_area_pairs,
    COUNT(DISTINCT LOWER(BTRIM(f."sport_code")))
      FILTER (WHERE f."result" IN ('WIN'::"CalendarEventResult", 'LOSS'::"CalendarEventResult") AND NULLIF(BTRIM(f."sport_code"), '') IS NOT NULL)::int AS scored_sports,
    COUNT(DISTINCT DATE_TRUNC('month', f.local_start))::int AS months,
    COUNT(DISTINCT f."site"::text) FILTER (WHERE f."site" IS NOT NULL)::int AS sites,
    COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM f.local_start) < 7)::int AS early_starts,
    COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM f.local_end) >= 22 OR f.local_end::date > f.local_start::date)::int AS late_finishes,
    COUNT(*) FILTER (WHERE f."site" = 'HOME'::"CalendarEventSite" OR (f."site" IS NULL AND f."is_home" = true))::int AS home_events,
    COUNT(*) FILTER (WHERE f."site" = 'AWAY'::"CalendarEventSite" OR (f."site" IS NULL AND f."is_home" = false))::int AS away_events,
    COUNT(*) FILTER (
      WHERE (f."site" = 'AWAY'::"CalendarEventSite" OR (f."site" IS NULL AND f."is_home" = false))
        AND f."result" = 'WIN'::"CalendarEventResult"
    )::int AS away_wins,
    COUNT(*) FILTER (
      WHERE f."site" = 'HOME'::"CalendarEventSite"
        AND f."result" = 'WIN'::"CalendarEventResult"
    )::int AS home_wins,
    COUNT(*) FILTER (
      WHERE f."site" = 'NEUTRAL'::"CalendarEventSite"
        AND f."result" = 'WIN'::"CalendarEventResult"
    )::int AS neutral_wins
  FROM assignment_facts f
  GROUP BY f."user_id"
), shift_rule_counts AS (
  SELECT f."user_id", 'shift_away_completed' AS rule_key, COUNT(*)::int AS total
  FROM assignment_facts f
  WHERE f."site" = 'AWAY'::"CalendarEventSite" OR (f."site" IS NULL AND f."is_home" = false)
  GROUP BY f."user_id"
  UNION ALL
  SELECT f."user_id", 'shift_before_7', COUNT(*)::int
  FROM assignment_facts f WHERE EXTRACT(HOUR FROM f.local_start) < 7 GROUP BY f."user_id"
  UNION ALL
  SELECT f."user_id", 'shift_sports', COUNT(DISTINCT LOWER(BTRIM(f."sport_code")))::int
  FROM assignment_facts f WHERE NULLIF(BTRIM(f."sport_code"), '') IS NOT NULL GROUP BY f."user_id"
  UNION ALL
  SELECT f."user_id", 'shift_areas', COUNT(DISTINCT LOWER(BTRIM(f."area"::text)))::int
  FROM assignment_facts f
  WHERE NULLIF(BTRIM(f."area"::text), '') IS NOT NULL
  GROUP BY f."user_id"
  UNION ALL
  SELECT d."user_id", 'shift_doubleheader_days', COUNT(*)::int
  FROM doubleheader_days d GROUP BY d."user_id"
  UNION ALL
  SELECT f."user_id", 'shift_after_22', COUNT(*)::int
  FROM assignment_facts f
  WHERE EXTRACT(HOUR FROM f.local_end) >= 22 OR f.local_end::date > f.local_start::date
  GROUP BY f."user_id"
  UNION ALL
  SELECT f."user_id", 'shift_wins', COUNT(*)::int
  FROM assignment_facts f WHERE f."result" = 'WIN'::"CalendarEventResult" GROUP BY f."user_id"
  UNION ALL
  SELECT f."user_id", 'shift_losses', COUNT(*)::int
  FROM assignment_facts f WHERE f."result" = 'LOSS'::"CalendarEventResult" GROUP BY f."user_id"
  UNION ALL
  SELECT f."user_id", 'shift_home', COUNT(*)::int
  FROM assignment_facts f
  WHERE f."site" = 'HOME'::"CalendarEventSite" OR (f."site" IS NULL AND f."is_home" = true)
  GROUP BY f."user_id"
  UNION ALL
  SELECT f."user_id", 'shift_neutral', COUNT(*)::int
  FROM assignment_facts f WHERE f."site" = 'NEUTRAL'::"CalendarEventSite" GROUP BY f."user_id"
  UNION ALL
  SELECT f."user_id", 'shift_venues', COUNT(DISTINCT BTRIM(f."location_id"))::int
  FROM assignment_facts f WHERE NULLIF(BTRIM(f."location_id"), '') IS NOT NULL GROUP BY f."user_id"
  UNION ALL
  SELECT v."user_id", 'shift_same_venue', MAX(v.total)::int
  FROM venue_counts v GROUP BY v."user_id"
  UNION ALL
  SELECT f."user_id", 'shift_opponents', COUNT(DISTINCT LOWER(BTRIM(f."opponent")))::int
  FROM assignment_facts f WHERE NULLIF(BTRIM(f."opponent"), '') IS NOT NULL GROUP BY f."user_id"
  UNION ALL
  SELECT o."user_id", 'shift_same_opponent', MAX(o.total)::int
  FROM opponent_counts o GROUP BY o."user_id"
  UNION ALL
  SELECT f."user_id", 'shift_conflicts', COUNT(*)::int
  FROM assignment_facts f WHERE f."has_conflict" = true GROUP BY f."user_id"
  UNION ALL
  SELECT s."user_id", 'shift_sport_area_pairs', s.sport_area_pairs
  FROM shift_summary s
  UNION ALL
  SELECT s."user_id", 'shift_months', s.months
  FROM shift_summary s
  UNION ALL
  SELECT s."user_id", 'shift_home_and_away', CASE WHEN s.home_events > 0 AND s.away_events > 0 THEN 1 ELSE 0 END
  FROM shift_summary s
  UNION ALL
  SELECT s."user_id", 'shift_spectrum', CASE WHEN s.sports >= 5 AND s.areas >= 3 THEN 1 ELSE 0 END
  FROM shift_summary s
  UNION ALL
  SELECT s."user_id", 'shift_away_wins', s.away_wins
  FROM shift_summary s
  UNION ALL
  SELECT s."user_id", 'shift_result_sites', CASE
    WHEN s.home_wins > 0 AND s.away_wins > 0 AND s.neutral_wins > 0 THEN 1
    ELSE 0
  END
  FROM shift_summary s
  UNION ALL
  SELECT s."user_id", 'shift_early_late_mix', CASE WHEN s.early_starts >= 3 AND s.late_finishes >= 5 THEN 1 ELSE 0 END
  FROM shift_summary s
  UNION ALL
  SELECT s."user_id", 'shift_scored_sports', s.scored_sports
  FROM shift_summary s
  UNION ALL
  SELECT s."user_id", 'shift_winning_record', CASE WHEN s.wins >= 8 AND s.wins > s.losses THEN 1 ELSE 0 END
  FROM shift_summary s
  UNION ALL
  SELECT w."user_id", 'shift_win_streak', w.total
  FROM win_streaks w
  UNION ALL
  SELECT b."user_id", 'shift_bounce_back', b.total
  FROM bounce_backs b
  UNION ALL
  SELECT s."user_id", 'shift_battle_tested', CASE WHEN s.wins >= 3 AND s.losses >= 3 THEN 1 ELSE 0 END
  FROM shift_summary s
  UNION ALL
  SELECT s."user_id", 'shift_sites', s.sites
  FROM shift_summary s
)
INSERT INTO "student_badges" ("id", "user_id", "definition_id")
SELECT 'badge_backfill_' || md5(c."user_id" || ':' || d."id"), c."user_id", d."id"
FROM shift_rule_counts c
JOIN "badge_definitions" d
  ON d."active" = true
  AND d."trigger" = 'shift:completed'
  AND d."rule_key" = c.rule_key
  AND d."threshold" <= c.total
ON CONFLICT ("user_id", "definition_id") DO NOTHING;

-- App-open surprises begin at migration time. The past cannot be inferred
-- from an authenticated foreground event, so no history is invented here.
