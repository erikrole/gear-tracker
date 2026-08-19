-- Three automatic badges read from the return moment itself: a long clean
-- custody, a same-day turnaround, and a hidden buzzer beater. The catalog
-- already counts how many returns were on time; nothing recognised how the
-- return actually went.

INSERT INTO "badge_definitions" (
  "id", "key", "name", "description", "icon",
  "category", "kind", "trigger", "threshold", "rule_key", "active", "sort_order"
)
VALUES
  ('seed_badge_long_haul', 'long_haul', 'Long Haul', 'Returned five checkouts held a week or longer with nothing damaged or missing.', 'Truck', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:returned', 5, 'return_long_haul', true, 896),
  ('seed_badge_round_trip', 'round_trip', 'Round Trip', 'Opened and returned twenty-five checkouts inside the same day.', 'ArrowLeftRight', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:returned', 25, 'return_same_day', true, 898),
  ('seed_badge_buzzer_beater', 'buzzer_beater', 'Buzzer Beater', 'Returned three checkouts in the last five minutes before they were due.', 'Timer', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:returned', 3, 'return_buzzer_beater', true, 915)
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

-- Backfill from completed custody rows. Return outcomes belong to the current
-- custodian, matching the v6 ownership rule, so these read
-- `bookings.requester_user_id` rather than the opened-credit receipts.
WITH completed_returns AS (
  SELECT
    b."requester_user_id" AS user_id,
    b."starts_at",
    b."ends_at",
    COALESCE(b."completed_at", b."updated_at") AS returned_at,
    EXISTS (
      SELECT 1 FROM "checkin_item_reports" r WHERE r."booking_id" = b."id"
    ) AS has_reports
  FROM "bookings" b
  WHERE b."kind" = 'CHECKOUT'::"BookingKind"
    AND b."status" = 'COMPLETED'::"BookingStatus"
), rule_counts AS (
  SELECT c.user_id, 'return_long_haul' AS rule_key, COUNT(*)::int AS total
  FROM completed_returns c
  WHERE c.returned_at - c."starts_at" >= INTERVAL '7 days'
    AND c.has_reports = false
  GROUP BY c.user_id
  UNION ALL
  SELECT c.user_id, 'return_same_day', COUNT(*)::int
  FROM completed_returns c
  WHERE (c."starts_at" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')::date
      = (c.returned_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')::date
  GROUP BY c.user_id
  UNION ALL
  -- Strictly at or before the due moment; the 15-minute on-time grace does not
  -- widen this window.
  SELECT c.user_id, 'return_buzzer_beater', COUNT(*)::int
  FROM completed_returns c
  WHERE c.returned_at <= c."ends_at"
    AND c.returned_at >= c."ends_at" - INTERVAL '5 minutes'
  GROUP BY c.user_id
)
INSERT INTO "student_badges" ("id", "user_id", "definition_id")
SELECT
  'badge_backfill_' || md5(c.user_id || ':' || d."id"),
  c.user_id,
  d."id"
FROM rule_counts c
JOIN "badge_definitions" d
  ON d."active" = true
  AND d."rule_key" = c.rule_key
  AND d."threshold" <= c.total
ON CONFLICT ("user_id", "definition_id") DO NOTHING;
