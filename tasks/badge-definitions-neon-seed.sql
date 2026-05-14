-- Badge catalog seed for Neon SQL Editor.
-- Use this only when Prisma seed cannot run from the terminal.

INSERT INTO "system_config" ("key", "value", "updated_at")
VALUES ('badges.peerVisible', 'true'::jsonb, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "badge_definitions" (
  "id", "key", "name", "description", "icon", "category", "kind",
  "trigger", "threshold", "rule_key", "active", "sort_order"
)
VALUES
  ('cmmbadge000000000000001', 'first_checkout', 'First Checkout', 'Opened a first gear checkout.', 'PackageCheck', 'CHECKOUT', 'COUNT', 'checkout:opened', 1, NULL, true, 10),
  ('cmmbadge000000000000002', 'checkout_5', 'Gear Regular', 'Opened five gear checkouts.', 'PackageOpen', 'CHECKOUT', 'COUNT', 'checkout:opened', 5, NULL, true, 20),
  ('cmmbadge000000000000003', 'checkout_25', 'Gear Veteran', 'Opened 25 gear checkouts.', 'Boxes', 'CHECKOUT', 'COUNT', 'checkout:opened', 25, NULL, true, 30),
  ('cmmbadge000000000000004', 'checkout_100', 'Gear Master', 'Opened 100 gear checkouts.', 'Warehouse', 'CHECKOUT', 'COUNT', 'checkout:opened', 100, NULL, true, 40),
  ('cmmbadge000000000000021', 'full_kit_no_misses', 'Full Kit, No Misses', 'Returned a large kit with every item accounted for.', 'Boxes', 'CHECKOUT', 'RULE', 'manual', NULL, 'full_kit_no_misses', true, 50),
  ('cmmbadge000000000000005', 'on_time_1', 'Punctual', 'Returned a checkout on time.', 'Clock3', 'ON_TIME', 'COUNT', 'checkout:returned', 1, 'on_time_return', true, 110),
  ('cmmbadge000000000000006', 'on_time_10', 'Reliable', 'Returned ten checkouts on time.', 'CalendarCheck2', 'ON_TIME', 'COUNT', 'checkout:returned', 10, 'on_time_return', true, 120),
  ('cmmbadge000000000000007', 'on_time_50', 'Clockwork', 'Returned 50 checkouts on time.', 'AlarmClockCheck', 'ON_TIME', 'COUNT', 'checkout:returned', 50, 'on_time_return', true, 130),
  ('cmmbadge000000000000022', 'perfect_handoff', 'Perfect Handoff', 'Returned a checkout on time with everything accounted for.', 'ShieldCheck', 'ON_TIME', 'RULE', 'manual', NULL, 'perfect_handoff', true, 140),
  ('cmmbadge000000000000008', 'first_scan', 'Scanner', 'Completed a first successful kiosk scan.', 'ScanLine', 'SCAN', 'COUNT', 'scan:success', 1, NULL, true, 210),
  ('cmmbadge000000000000009', 'scan_25', 'Scan Pro', 'Completed 25 successful kiosk scans.', 'ScanSearch', 'SCAN', 'COUNT', 'scan:success', 25, NULL, true, 220),
  ('cmmbadge000000000000010', 'scan_100', 'Scan Master', 'Completed 100 successful kiosk scans.', 'QrCode', 'SCAN', 'COUNT', 'scan:success', 100, NULL, true, 230),
  ('cmmbadge000000000000011', 'zero_errors', 'Clean Scanner', 'Completed ten kiosk scans in a row without an error.', 'ShieldCheck', 'SCAN', 'RULE', 'scan:rule', 10, 'zero_errors', true, 240),
  ('cmmbadge000000000000012', 'first_shift', 'On Duty', 'Retired: attendance-based shift badges are out of scope.', 'CalendarClock', 'SHIFT', 'COUNT', 'shift:completed', 1, 'retired_shift_attendance', false, 310),
  ('cmmbadge000000000000013', 'shift_10', 'Shift Regular', 'Retired: attendance-based shift badges are out of scope.', 'CalendarDays', 'SHIFT', 'COUNT', 'shift:completed', 10, 'retired_shift_attendance', false, 320),
  ('cmmbadge000000000000014', 'shift_50', 'Shift Veteran', 'Retired: attendance-based shift badges are out of scope.', 'CalendarRange', 'SHIFT', 'COUNT', 'shift:completed', 50, 'retired_shift_attendance', false, 330),
  ('cmmbadge000000000000015', 'first_trade', 'Team Player', 'Completed a first shift trade.', 'Handshake', 'TRADE', 'COUNT', 'trade:completed', 1, NULL, true, 410),
  ('cmmbadge000000000000016', 'trade_10', 'Trade Expert', 'Completed ten shift trades.', 'Repeat2', 'TRADE', 'COUNT', 'trade:completed', 10, NULL, true, 420),
  ('cmmbadge000000000000023', 'clutch_cover', 'Clutch Cover', 'Helped cover a last-minute shift trade.', 'Handshake', 'TRADE', 'RULE', 'manual', NULL, 'clutch_cover', true, 430),
  ('cmmbadge000000000000017', 'streak_on_time_5', 'On a Roll', 'Returned five checkouts in a row on time.', 'Flame', 'STREAK', 'STREAK', 'checkout:returned', 5, 'on_time_return_streak', true, 510),
  ('cmmbadge000000000000018', 'streak_on_time_10', 'Locked In', 'Returned ten checkouts in a row on time.', 'BadgeCheck', 'STREAK', 'STREAK', 'checkout:returned', 10, 'on_time_return_streak', true, 520),
  ('cmmbadge000000000000019', 'streak_shifts_5', 'Showing Up', 'Retired: attendance-based shift badges are out of scope.', 'UserCheck', 'STREAK', 'STREAK', 'shift:completed', 5, 'retired_shift_attendance', false, 610),
  ('cmmbadge000000000000020', 'streak_shifts_10', 'Iron Schedule', 'Retired: attendance-based shift badges are out of scope.', 'Trophy', 'STREAK', 'STREAK', 'shift:completed', 10, 'retired_shift_attendance', false, 620),
  ('cmmbadge000000000000024', 'semester_streak', 'Semester Streak', 'Finished a semester with no overdue gear.', 'CalendarCheck2', 'STREAK', 'RULE', 'manual', NULL, 'semester_streak', true, 630),
  ('cmmbadge000000000000025', 'clean_loop', 'Clean Loop', 'Completed a full gear workflow with clean scans and return.', 'BadgeCheck', 'MILESTONE', 'RULE', 'manual', NULL, 'clean_loop', true, 710),
  ('cmmbadge000000000000026', 'category_collector', 'Category Collector', 'Earned badges across every major badge category.', 'Trophy', 'MILESTONE', 'RULE', 'manual', NULL, 'category_collector', true, 720),
  ('cmmbadge000000000000027', 'event_hero', 'Event Hero', 'Recognized by staff for standout help during an event.', 'UserCheck', 'MILESTONE', 'RULE', 'manual', NULL, 'event_hero', true, 730),
  ('cmmbadge000000000000028', 'rookie_run', 'Rookie Run', 'Completed a first clean gear workflow from checkout through return.', 'PackageCheck', 'MILESTONE', 'RULE', 'manual', NULL, 'rookie_run', true, 740),
  ('cmmbadge000000000000029', 'reliable_regular', 'Reliable Regular', 'Went 30 days with no overdue gear or missed commitments.', 'CalendarDays', 'MILESTONE', 'RULE', 'manual', NULL, 'reliable_regular', true, 750),
  ('cmmbadge000000000000030', 'above_and_beyond', 'Above and Beyond', 'Recognized for memorable help that made the operation better.', 'Trophy', 'MILESTONE', 'RULE', 'manual', NULL, 'above_and_beyond', true, 760)
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
