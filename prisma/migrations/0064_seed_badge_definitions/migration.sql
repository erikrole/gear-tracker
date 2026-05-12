-- Seed badge definitions through migrate deploy because production builds do not run prisma/seed.mjs.
INSERT INTO "system_config" ("key", "value", "updated_at")
VALUES ('badges.peerVisible', 'true'::jsonb, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "badge_definitions" (
  "id",
  "key",
  "name",
  "description",
  "icon",
  "category",
  "kind",
  "trigger",
  "threshold",
  "rule_key",
  "active",
  "sort_order"
)
VALUES
  ('seed_badge_first_checkout', 'first_checkout', 'First Checkout', 'Opened a first gear checkout.', 'PackageCheck', 'CHECKOUT'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:opened', 1, NULL, true, 10),
  ('seed_badge_checkout_5', 'checkout_5', 'Gear Regular', 'Opened five gear checkouts.', 'PackageOpen', 'CHECKOUT'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:opened', 5, NULL, true, 20),
  ('seed_badge_checkout_25', 'checkout_25', 'Gear Veteran', 'Opened 25 gear checkouts.', 'Boxes', 'CHECKOUT'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:opened', 25, NULL, true, 30),
  ('seed_badge_checkout_100', 'checkout_100', 'Gear Master', 'Opened 100 gear checkouts.', 'Warehouse', 'CHECKOUT'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:opened', 100, NULL, true, 40),
  ('seed_badge_full_kit_no_misses', 'full_kit_no_misses', 'Full Kit, No Misses', 'Returned a large kit with every item accounted for.', 'Boxes', 'CHECKOUT'::"BadgeCategory", 'RULE'::"BadgeKind", 'manual', NULL, 'full_kit_no_misses', true, 50),
  ('seed_badge_on_time_1', 'on_time_1', 'Punctual', 'Returned a checkout on time.', 'Clock3', 'ON_TIME'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:returned', 1, 'on_time_return', true, 110),
  ('seed_badge_on_time_10', 'on_time_10', 'Reliable', 'Returned ten checkouts on time.', 'CalendarCheck2', 'ON_TIME'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:returned', 10, 'on_time_return', true, 120),
  ('seed_badge_on_time_50', 'on_time_50', 'Clockwork', 'Returned 50 checkouts on time.', 'AlarmClockCheck', 'ON_TIME'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:returned', 50, 'on_time_return', true, 130),
  ('seed_badge_perfect_handoff', 'perfect_handoff', 'Perfect Handoff', 'Returned a checkout on time with everything accounted for.', 'ShieldCheck', 'ON_TIME'::"BadgeCategory", 'RULE'::"BadgeKind", 'manual', NULL, 'perfect_handoff', true, 140),
  ('seed_badge_first_scan', 'first_scan', 'Scanner', 'Completed a first successful kiosk scan.', 'ScanLine', 'SCAN'::"BadgeCategory", 'COUNT'::"BadgeKind", 'scan:success', 1, NULL, true, 210),
  ('seed_badge_scan_25', 'scan_25', 'Scan Pro', 'Completed 25 successful kiosk scans.', 'ScanSearch', 'SCAN'::"BadgeCategory", 'COUNT'::"BadgeKind", 'scan:success', 25, NULL, true, 220),
  ('seed_badge_scan_100', 'scan_100', 'Scan Master', 'Completed 100 successful kiosk scans.', 'QrCode', 'SCAN'::"BadgeCategory", 'COUNT'::"BadgeKind", 'scan:success', 100, NULL, true, 230),
  ('seed_badge_zero_errors', 'zero_errors', 'Clean Scanner', 'Completed ten kiosk scans in a row without an error.', 'ShieldCheck', 'SCAN'::"BadgeCategory", 'RULE'::"BadgeKind", 'scan:rule', 10, 'zero_errors', true, 240),
  ('seed_badge_first_shift', 'first_shift', 'On Duty', 'Completed a first shift after attendance tracking ships.', 'CalendarClock', 'SHIFT'::"BadgeCategory", 'COUNT'::"BadgeKind", 'shift:completed', 1, 'deferred_attendance', true, 310),
  ('seed_badge_shift_10', 'shift_10', 'Shift Regular', 'Completed ten shifts after attendance tracking ships.', 'CalendarDays', 'SHIFT'::"BadgeCategory", 'COUNT'::"BadgeKind", 'shift:completed', 10, 'deferred_attendance', true, 320),
  ('seed_badge_shift_50', 'shift_50', 'Shift Veteran', 'Completed 50 shifts after attendance tracking ships.', 'CalendarRange', 'SHIFT'::"BadgeCategory", 'COUNT'::"BadgeKind", 'shift:completed', 50, 'deferred_attendance', true, 330),
  ('seed_badge_first_trade', 'first_trade', 'Team Player', 'Completed a first shift trade.', 'Handshake', 'TRADE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'trade:completed', 1, NULL, true, 410),
  ('seed_badge_trade_10', 'trade_10', 'Trade Expert', 'Completed ten shift trades.', 'Repeat2', 'TRADE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'trade:completed', 10, NULL, true, 420),
  ('seed_badge_clutch_cover', 'clutch_cover', 'Clutch Cover', 'Helped cover a last-minute shift trade.', 'Handshake', 'TRADE'::"BadgeCategory", 'RULE'::"BadgeKind", 'manual', NULL, 'clutch_cover', true, 430),
  ('seed_badge_streak_on_time_5', 'streak_on_time_5', 'On a Roll', 'Returned five checkouts in a row on time.', 'Flame', 'STREAK'::"BadgeCategory", 'STREAK'::"BadgeKind", 'checkout:returned', 5, 'on_time_return_streak', true, 510),
  ('seed_badge_streak_on_time_10', 'streak_on_time_10', 'Locked In', 'Returned ten checkouts in a row on time.', 'BadgeCheck', 'STREAK'::"BadgeCategory", 'STREAK'::"BadgeKind", 'checkout:returned', 10, 'on_time_return_streak', true, 520),
  ('seed_badge_streak_shifts_5', 'streak_shifts_5', 'Showing Up', 'Completed five shifts in a row after attendance tracking ships.', 'UserCheck', 'STREAK'::"BadgeCategory", 'STREAK'::"BadgeKind", 'shift:completed', 5, 'deferred_attendance_streak', true, 610),
  ('seed_badge_streak_shifts_10', 'streak_shifts_10', 'Iron Schedule', 'Completed ten shifts in a row after attendance tracking ships.', 'Trophy', 'STREAK'::"BadgeCategory", 'STREAK'::"BadgeKind", 'shift:completed', 10, 'deferred_attendance_streak', true, 620),
  ('seed_badge_semester_streak', 'semester_streak', 'Semester Streak', 'Finished a semester with no overdue gear.', 'CalendarCheck2', 'STREAK'::"BadgeCategory", 'RULE'::"BadgeKind", 'manual', NULL, 'semester_streak', true, 630),
  ('seed_badge_clean_loop', 'clean_loop', 'Clean Loop', 'Completed a full gear workflow with clean scans and return.', 'BadgeCheck', 'MILESTONE'::"BadgeCategory", 'RULE'::"BadgeKind", 'manual', NULL, 'clean_loop', true, 710),
  ('seed_badge_category_collector', 'category_collector', 'Category Collector', 'Earned badges across every major badge category.', 'Trophy', 'MILESTONE'::"BadgeCategory", 'RULE'::"BadgeKind", 'manual', NULL, 'category_collector', true, 720),
  ('seed_badge_event_hero', 'event_hero', 'Event Hero', 'Recognized by staff for standout help during an event.', 'UserCheck', 'MILESTONE'::"BadgeCategory", 'RULE'::"BadgeKind", 'manual', NULL, 'event_hero', true, 730),
  ('seed_badge_rookie_run', 'rookie_run', 'Rookie Run', 'Completed a first clean gear workflow from checkout through return.', 'PackageCheck', 'MILESTONE'::"BadgeCategory", 'RULE'::"BadgeKind", 'manual', NULL, 'rookie_run', true, 740),
  ('seed_badge_reliable_regular', 'reliable_regular', 'Reliable Regular', 'Went 30 days with no overdue gear or missed commitments.', 'CalendarDays', 'MILESTONE'::"BadgeCategory", 'RULE'::"BadgeKind", 'manual', NULL, 'reliable_regular', true, 750),
  ('seed_badge_above_and_beyond', 'above_and_beyond', 'Above and Beyond', 'Recognized for memorable help that made the operation better.', 'Trophy', 'MILESTONE'::"BadgeCategory", 'RULE'::"BadgeKind", 'manual', NULL, 'above_and_beyond', true, 760)
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "icon" = EXCLUDED."icon",
  "category" = EXCLUDED."category",
  "kind" = EXCLUDED."kind",
  "trigger" = EXCLUDED."trigger",
  "threshold" = EXCLUDED."threshold",
  "rule_key" = EXCLUDED."rule_key",
  "sort_order" = EXCLUDED."sort_order";
