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
  ('cmmbadge000000000000005', 'on_time_1', 'Punctual', 'Returned a checkout on time.', 'Clock3', 'ON_TIME', 'COUNT', 'checkout:returned', 1, 'on_time_return', true, 110),
  ('cmmbadge000000000000006', 'on_time_10', 'Reliable', 'Returned ten checkouts on time.', 'CalendarCheck2', 'ON_TIME', 'COUNT', 'checkout:returned', 10, 'on_time_return', true, 120),
  ('cmmbadge000000000000007', 'on_time_50', 'Clockwork', 'Returned 50 checkouts on time.', 'AlarmClockCheck', 'ON_TIME', 'COUNT', 'checkout:returned', 50, 'on_time_return', true, 130),
  ('cmmbadge000000000000008', 'first_scan', 'Scanner', 'Completed a first successful kiosk scan.', 'ScanLine', 'SCAN', 'COUNT', 'scan:success', 1, NULL, true, 210),
  ('cmmbadge000000000000009', 'scan_25', 'Scan Pro', 'Completed 25 successful kiosk scans.', 'ScanSearch', 'SCAN', 'COUNT', 'scan:success', 25, NULL, true, 220),
  ('cmmbadge000000000000010', 'scan_100', 'Scan Master', 'Completed 100 successful kiosk scans.', 'QrCode', 'SCAN', 'COUNT', 'scan:success', 100, NULL, true, 230),
  ('cmmbadge000000000000011', 'zero_errors', 'Clean Scanner', 'Completed ten kiosk scans in a row without an error.', 'ShieldCheck', 'SCAN', 'RULE', 'scan:rule', 10, 'zero_errors', true, 240),
  ('cmmbadge000000000000012', 'first_shift', 'On Duty', 'Completed a first shift after attendance tracking ships.', 'CalendarClock', 'SHIFT', 'COUNT', 'shift:completed', 1, 'deferred_attendance', true, 310),
  ('cmmbadge000000000000013', 'shift_10', 'Shift Regular', 'Completed ten shifts after attendance tracking ships.', 'CalendarDays', 'SHIFT', 'COUNT', 'shift:completed', 10, 'deferred_attendance', true, 320),
  ('cmmbadge000000000000014', 'shift_50', 'Shift Veteran', 'Completed 50 shifts after attendance tracking ships.', 'CalendarRange', 'SHIFT', 'COUNT', 'shift:completed', 50, 'deferred_attendance', true, 330),
  ('cmmbadge000000000000015', 'first_trade', 'Team Player', 'Completed a first shift trade.', 'Handshake', 'TRADE', 'COUNT', 'trade:completed', 1, NULL, true, 410),
  ('cmmbadge000000000000016', 'trade_10', 'Trade Expert', 'Completed ten shift trades.', 'Repeat2', 'TRADE', 'COUNT', 'trade:completed', 10, NULL, true, 420),
  ('cmmbadge000000000000017', 'streak_on_time_5', 'On a Roll', 'Returned five checkouts in a row on time.', 'Flame', 'STREAK', 'STREAK', 'checkout:returned', 5, 'on_time_return_streak', true, 510),
  ('cmmbadge000000000000018', 'streak_on_time_10', 'Locked In', 'Returned ten checkouts in a row on time.', 'BadgeCheck', 'STREAK', 'STREAK', 'checkout:returned', 10, 'on_time_return_streak', true, 520),
  ('cmmbadge000000000000019', 'streak_shifts_5', 'Showing Up', 'Completed five shifts in a row after attendance tracking ships.', 'UserCheck', 'STREAK', 'STREAK', 'shift:completed', 5, 'deferred_attendance_streak', true, 610),
  ('cmmbadge000000000000020', 'streak_shifts_10', 'Iron Schedule', 'Completed ten shifts in a row after attendance tracking ships.', 'Trophy', 'STREAK', 'STREAK', 'shift:completed', 10, 'deferred_attendance_streak', true, 620)
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
