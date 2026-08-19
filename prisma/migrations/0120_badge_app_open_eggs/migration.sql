-- Two more hidden app-open surprises alongside `go_to_bed`. Both are decided by
-- the server's institution calendar, never by a device clock, and both can
-- award at most once per local day through their own receipt key.
--
-- There is nothing to backfill: app-open receipts only exist from the moment
-- the rule ships, and inventing history for a date that has already passed
-- would award a surprise nobody was there for.

INSERT INTO "badge_definitions" (
  "id", "key", "name", "description", "icon",
  "category", "kind", "trigger", "threshold", "rule_key", "active", "sort_order"
)
VALUES
  ('seed_badge_take_thirteen', 'take_thirteen', 'Take Thirteen', 'Opened the app on a Friday the 13th.', 'Clapperboard', 'MILESTONE'::"BadgeCategory", 'RULE'::"BadgeKind", 'app:opened', NULL, 'local_friday_13', true, 920),
  ('seed_badge_holiday_hours', 'holiday_hours', 'Holiday Hours', 'Opened the app on December 25 or January 1. The season does not stop.', 'Gift', 'MILESTONE'::"BadgeCategory", 'RULE'::"BadgeKind", 'app:opened', NULL, 'local_holiday', true, 925)
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
