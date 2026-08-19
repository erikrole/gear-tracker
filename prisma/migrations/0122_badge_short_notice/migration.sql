-- Short-notice trade cover. The trade ladder counts how many trades a person
-- completed; nothing recognised picking one up the day it mattered.

INSERT INTO "badge_definitions" (
  "id", "key", "name", "description", "icon",
  "category", "kind", "trigger", "threshold", "rule_key", "active", "sort_order"
)
VALUES
  ('seed_badge_short_notice', 'short_notice', 'Short Notice', 'Claimed three shift trades inside the last day before the shift started.', 'AlarmClock', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'trade:completed', 3, 'trade_short_notice', true, 865)
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

-- Backfill from completed trades, credited to the claimer. A claim recorded at
-- or after the shift start is excluded: that is usually paperwork written up
-- after the fact, which the data cannot tell apart from stepping in mid-shift.
WITH short_notice_claims AS (
  SELECT t."claimed_by_user_id" AS user_id, COUNT(*)::int AS total
  FROM "shift_trades" t
  JOIN "shift_assignments" sa ON sa."id" = t."shift_assignment_id"
  JOIN "shifts" s ON s."id" = sa."shift_id"
  WHERE t."status" = 'COMPLETED'::"ShiftTradeStatus"
    AND t."claimed_by_user_id" IS NOT NULL
    AND t."claimed_at" IS NOT NULL
    AND t."claimed_at" <= s."starts_at"
    AND t."claimed_at" >= s."starts_at" - INTERVAL '24 hours'
  GROUP BY t."claimed_by_user_id"
)
INSERT INTO "student_badges" ("id", "user_id", "definition_id")
SELECT
  'badge_backfill_' || md5(c.user_id || ':' || d."id"),
  c.user_id,
  d."id"
FROM short_notice_claims c
JOIN "badge_definitions" d
  ON d."active" = true
  AND d."rule_key" = 'trade_short_notice'
  AND d."threshold" <= c.total
ON CONFLICT ("user_id", "definition_id") DO NOTHING;
