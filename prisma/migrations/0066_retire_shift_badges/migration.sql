UPDATE "badge_definitions"
SET
  "active" = false,
  "description" = 'Retired: attendance-based shift badges are out of scope.',
  "rule_key" = 'retired_shift_attendance'
WHERE "key" IN (
  'first_shift',
  'shift_10',
  'shift_50',
  'streak_shifts_5',
  'streak_shifts_10'
);
