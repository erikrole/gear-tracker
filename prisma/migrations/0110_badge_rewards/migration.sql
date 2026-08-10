-- Badge reward delivery, immutable checkout credit, catalog cleanup, and
-- completed-progress repair. Existing definitions and awards are preserved.

CREATE TABLE "badge_event_receipts" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "source_key" TEXT NOT NULL,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "badge_event_receipts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "badge_event_receipts_user_id_event_type_source_key_key"
  ON "badge_event_receipts"("user_id", "event_type", "source_key");
CREATE INDEX "badge_event_receipts_received_at_idx"
  ON "badge_event_receipts"("received_at");

ALTER TABLE "badge_event_receipts"
  ADD CONSTRAINT "badge_event_receipts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Freeze historical checkout-open credit before future owner transfers can
-- rewrite it. Only a transfer after a recorded kiosk-open audit can establish
-- a different opener. A pre-open transfer moves the future earning opportunity
-- to the current requester, and an ambiguous legacy row stays with that current
-- requester rather than guessing from an undated lifecycle transition.
WITH open_events AS (
  SELECT DISTINCT ON (a."entity_id")
    a."entity_id" AS booking_id,
    a."created_at" AS opened_at,
    a."id" AS audit_id
  FROM "audit_logs" a
  WHERE a."entity_type" = 'booking'
    AND a."action" IN ('kiosk_checkout', 'kiosk_pickup')
  ORDER BY a."entity_id", a."created_at" ASC, a."id" ASC
), opened_credit AS (
  SELECT
    b."id" AS booking_id,
    COALESCE(
      (
        SELECT NULLIF(a."before_json" ->> 'requesterUserId', '')
        FROM "audit_logs" a
        JOIN open_events o ON o.booking_id = b."id"
        WHERE a."entity_type" = 'booking'
          AND a."entity_id" = b."id"
          AND a."action" = 'owner_transferred'
          AND (
            a."created_at" > o.opened_at
            OR (a."created_at" = o.opened_at AND a."id" > o.audit_id)
          )
        ORDER BY a."created_at" ASC, a."id" ASC
        LIMIT 1
      ),
      b."requester_user_id"
    ) AS user_id
  FROM "bookings" b
  WHERE b."kind" = 'CHECKOUT'::"BookingKind"
    AND b."status" IN ('OPEN'::"BookingStatus", 'COMPLETED'::"BookingStatus")
)
INSERT INTO "badge_event_receipts" ("id", "user_id", "event_type", "source_key")
SELECT
  'badge_opened_' || md5(c.user_id || ':' || c.booking_id),
  c.user_id,
  'checkout_opened',
  c.booking_id
FROM opened_credit c
JOIN "users" u ON u."id" = c.user_id
ON CONFLICT ("user_id", "event_type", "source_key") DO NOTHING;

-- Keep the bridge definitions from the reward slice, but the scan bridge is
-- born retired because successful scanning is an operational baseline now.
INSERT INTO "badge_definitions" (
  "id", "key", "name", "description", "icon",
  "category", "kind", "trigger", "threshold", "rule_key", "active", "sort_order"
)
VALUES
  ('seed_badge_on_time_5', 'on_time_5', 'Right on Time', 'Returned five checkouts on time.', 'Clock3', 'ON_TIME'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:returned', 5, 'on_time_return', true, 115),
  ('seed_badge_scan_10', 'scan_10', 'Scan Ready', 'Retired: every accepted kiosk scan is expected to succeed.', 'ScanLine', 'SCAN'::"BadgeCategory", 'COUNT'::"BadgeKind", 'scan:success', 10, NULL, false, 215),
  ('seed_badge_shift_25', 'shift_25', 'Crew Mainstay', 'Was assigned to 25 completed event shifts.', 'CalendarDays', 'SHIFT'::"BadgeCategory", 'COUNT'::"BadgeKind", 'shift:completed', 25, NULL, true, 325),
  ('seed_badge_trade_5', 'trade_5', 'Coverage Crew', 'Completed five shift trades.', 'Handshake', 'TRADE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'trade:completed', 5, NULL, true, 415),
  ('seed_badge_power_player', 'power_player', 'Power Player', 'Checked out gear with batteries ten times.', 'BatteryCharging', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:opened', 10, 'checkout_family_batteries', true, 770),
  ('seed_badge_glass_class', 'glass_class', 'Glass Class', 'Checked out lenses ten times.', 'Aperture', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:opened', 10, 'checkout_family_lenses', true, 780),
  ('seed_badge_sound_check', 'sound_check', 'Sound Check', 'Checked out audio gear five times.', 'AudioLines', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:opened', 5, 'checkout_family_audio', true, 790),
  ('seed_badge_rock_solid', 'rock_solid', 'Rock Solid', 'Checked out a tripod or gimbal three times.', 'Focus', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:opened', 3, 'checkout_support', true, 800),
  ('seed_badge_bright_spark', 'bright_spark', 'Bright Spark', 'Checked out lighting gear twice.', 'Lightbulb', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:opened', 2, 'checkout_family_lighting', true, 810),
  ('seed_badge_kitchen_sink', 'kitchen_sink', 'Kitchen Sink', 'Opened one checkout spanning five gear families.', 'LayoutGrid', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:opened', 1, 'checkout_families_5', true, 820),
  ('seed_badge_three_piece_suit', 'three_piece_suit', 'Three-Piece Suit', 'Checked out camera, lens, and audio gear together three times.', 'Combine', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:opened', 3, 'checkout_full_rig', true, 830),
  ('seed_badge_heavy_lifter', 'heavy_lifter', 'Heavy Lifter', 'Opened one checkout with at least 15 actual pieces.', 'Dumbbell', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:opened', 1, 'checkout_items_15', true, 840),
  ('seed_badge_road_tested', 'road_tested', 'Road Tested', 'Was assigned to three completed away-event shifts.', 'BusFront', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'shift:completed', 3, 'shift_away_completed', true, 850),
  ('seed_badge_before_sunrise', 'before_sunrise', 'Before Sunrise', 'Was assigned to two completed shifts with call times before 7 a.m.', 'Sunrise', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'shift:completed', 2, 'shift_before_7', true, 860),
  ('seed_badge_go_to_bed', 'go_to_bed', 'Go To Bed', 'Opened the app during the 2 a.m. hour. Seriously, go to bed.', 'MoonStar', 'MILESTONE'::"BadgeCategory", 'RULE'::"BadgeKind", 'app:opened', NULL, 'local_hour_2', true, 900)
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

-- Retire scan-count and clean-scan goals without deleting historical awards or
-- operational ScanEvent evidence.
UPDATE "badge_definitions"
SET
  "active" = false,
  "description" = CASE
    WHEN "key" = 'zero_errors' THEN 'Retired: clean scanning is the expected kiosk baseline.'
    ELSE 'Retired: every accepted kiosk scan is expected to succeed.'
  END
WHERE "key" IN ('first_scan', 'scan_10', 'scan_25', 'scan_50', 'scan_100', 'zero_errors');

-- The source proves assignment to a completed event, not physical attendance.
UPDATE "badge_definitions"
SET "description" = CASE "key"
  WHEN 'first_shift' THEN 'Was assigned to a first completed event shift.'
  WHEN 'shift_10' THEN 'Was assigned to ten completed event shifts.'
  WHEN 'shift_25' THEN 'Was assigned to 25 completed event shifts.'
  WHEN 'shift_50' THEN 'Was assigned to 50 completed event shifts.'
  ELSE "description"
END
WHERE "key" IN ('first_shift', 'shift_10', 'shift_25', 'shift_50');

-- Repair automatic checkout counts from immutable opened-credit receipts.
WITH counts AS (
  SELECT r."user_id", COUNT(*)::int AS total
  FROM "badge_event_receipts" r
  WHERE r."event_type" = 'checkout_opened'
  GROUP BY r."user_id"
)
INSERT INTO "student_badges" ("id", "user_id", "definition_id")
SELECT
  'badge_backfill_' || md5(c."user_id" || ':' || d."id"),
  c."user_id",
  d."id"
FROM counts c
JOIN "badge_definitions" d
  ON d."active" = true
  AND d."category" = 'CHECKOUT'::"BadgeCategory"
  AND d."trigger" = 'checkout:opened'
  AND d."threshold" <= c.total
ON CONFLICT ("user_id", "definition_id") DO NOTHING;

-- Repair on-time and damage-free return ladders from completed custody rows.
WITH on_time_counts AS (
  SELECT b."requester_user_id" AS user_id, COUNT(*)::int AS total
  FROM "bookings" b
  WHERE b."kind" = 'CHECKOUT'::"BookingKind"
    AND b."status" = 'COMPLETED'::"BookingStatus"
    AND COALESCE(b."completed_at", b."updated_at") <= b."ends_at" + INTERVAL '15 minutes'
  GROUP BY b."requester_user_id"
), damage_free_counts AS (
  SELECT b."requester_user_id" AS user_id, COUNT(*)::int AS total
  FROM "bookings" b
  WHERE b."kind" = 'CHECKOUT'::"BookingKind"
    AND b."status" = 'COMPLETED'::"BookingStatus"
    AND NOT EXISTS (
      SELECT 1 FROM "checkin_item_reports" r WHERE r."booking_id" = b."id"
    )
  GROUP BY b."requester_user_id"
), eligible AS (
  SELECT c.user_id, d."id" AS definition_id
  FROM on_time_counts c
  JOIN "badge_definitions" d
    ON d."active" = true
    AND d."rule_key" = 'on_time_return'
    AND d."threshold" <= c.total
  UNION
  SELECT c.user_id, d."id" AS definition_id
  FROM damage_free_counts c
  JOIN "badge_definitions" d
    ON d."active" = true
    AND d."rule_key" = 'damage_free_return'
    AND d."threshold" <= c.total
)
INSERT INTO "student_badges" ("id", "user_id", "definition_id")
SELECT
  'badge_backfill_' || md5(e.user_id || ':' || e.definition_id),
  e.user_id,
  e.definition_id
FROM eligible e
ON CONFLICT ("user_id", "definition_id") DO NOTHING;

-- Repair schedule and trade ladders from their durable completed outcomes.
WITH shift_counts AS (
  SELECT
    sa."user_id",
    COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE e."is_home" = false)::int AS away_total,
    COUNT(*) FILTER (
      WHERE EXTRACT(HOUR FROM (
        COALESCE(sa."call_starts_at", s."call_starts_at", s."starts_at")
          AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago'
      )) < 7
    )::int AS early_total
  FROM "shift_assignments" sa
  JOIN "shifts" s ON s."id" = sa."shift_id"
  JOIN "shift_groups" sg ON sg."id" = s."shift_group_id"
  JOIN "calendar_events" e ON e."id" = sg."event_id"
  WHERE sa."status" IN ('DIRECT_ASSIGNED'::"ShiftAssignmentStatus", 'APPROVED'::"ShiftAssignmentStatus")
    AND e."status" = 'CONFIRMED'::"CalendarEventStatus"
    AND e."ends_at" < CURRENT_TIMESTAMP
  GROUP BY sa."user_id"
), trade_people AS (
  SELECT t."posted_by_user_id" AS user_id FROM "shift_trades" t
  WHERE t."status" = 'COMPLETED'::"ShiftTradeStatus"
  UNION ALL
  SELECT t."claimed_by_user_id" AS user_id FROM "shift_trades" t
  WHERE t."status" = 'COMPLETED'::"ShiftTradeStatus" AND t."claimed_by_user_id" IS NOT NULL
), trade_counts AS (
  SELECT p.user_id, COUNT(*)::int AS total
  FROM trade_people p
  GROUP BY p.user_id
), eligible AS (
  SELECT c."user_id", d."id" AS definition_id
  FROM shift_counts c
  JOIN "badge_definitions" d
    ON d."active" = true
    AND d."category" = 'SHIFT'::"BadgeCategory"
    AND d."trigger" = 'shift:completed'
    AND d."threshold" <= c.total
  UNION
  SELECT c."user_id", d."id" AS definition_id
  FROM shift_counts c
  JOIN "badge_definitions" d
    ON d."active" = true
    AND d."rule_key" = 'shift_away_completed'
    AND d."threshold" <= c.away_total
  UNION
  SELECT c."user_id", d."id" AS definition_id
  FROM shift_counts c
  JOIN "badge_definitions" d
    ON d."active" = true
    AND d."rule_key" = 'shift_before_7'
    AND d."threshold" <= c.early_total
  UNION
  SELECT c.user_id, d."id" AS definition_id
  FROM trade_counts c
  JOIN "badge_definitions" d
    ON d."active" = true
    AND d."trigger" = 'trade:completed'
    AND d."threshold" <= c.total
)
INSERT INTO "student_badges" ("id", "user_id", "definition_id")
SELECT
  'badge_backfill_' || md5(e.user_id || ':' || e.definition_id),
  e.user_id,
  e.definition_id
FROM eligible e
ON CONFLICT ("user_id", "definition_id") DO NOTHING;

-- Repair Category Collector from the categories on checkouts credited to the
-- original opener, not whichever requester happens to own the row today.
WITH credited_categories AS (
  SELECT DISTINCT r."user_id", a."category_id"
  FROM "badge_event_receipts" r
  JOIN "booking_serialized_items" i ON i."booking_id" = r."source_key"
  JOIN "assets" a ON a."id" = i."asset_id"
  WHERE r."event_type" = 'checkout_opened' AND a."category_id" IS NOT NULL
  UNION
  SELECT DISTINCT r."user_id", s."category_id"
  FROM "badge_event_receipts" r
  JOIN "booking_bulk_items" i ON i."booking_id" = r."source_key"
  JOIN "bulk_skus" s ON s."id" = i."bulk_sku_id"
  WHERE r."event_type" = 'checkout_opened' AND s."category_id" IS NOT NULL
), category_counts AS (
  SELECT c."user_id", COUNT(*)::int AS total
  FROM credited_categories c
  GROUP BY c."user_id"
)
INSERT INTO "student_badges" ("id", "user_id", "definition_id")
SELECT
  'badge_backfill_' || md5(c."user_id" || ':' || d."id"),
  c."user_id",
  d."id"
FROM category_counts c
JOIN "badge_definitions" d
  ON d."active" = true
  AND d."rule_key" = 'category_collector'
  AND d."threshold" <= c.total
ON CONFLICT ("user_id", "definition_id") DO NOTHING;

-- Backfill the ten automatic fun badges from facts Gear Tracker already owns.
-- Category rules use the top-level family name; bulk rows count only pieces
-- that were actually handed out, never planned quantity.
WITH credited_booking_categories AS (
  SELECT DISTINCT
    r."user_id",
    r."source_key" AS booking_id,
    LOWER(COALESCE(parent."name", category."name")) AS family_name
  FROM "badge_event_receipts" r
  JOIN "booking_serialized_items" i ON i."booking_id" = r."source_key"
  JOIN "assets" a ON a."id" = i."asset_id"
  JOIN "categories" category ON category."id" = a."category_id"
  LEFT JOIN "categories" parent ON parent."id" = category."parent_id"
  WHERE r."event_type" = 'checkout_opened'
  UNION
  SELECT DISTINCT
    r."user_id",
    r."source_key" AS booking_id,
    LOWER(COALESCE(parent."name", category."name")) AS family_name
  FROM "badge_event_receipts" r
  JOIN "booking_bulk_items" i ON i."booking_id" = r."source_key"
  JOIN "bulk_skus" s ON s."id" = i."bulk_sku_id"
  JOIN "categories" category ON category."id" = s."category_id"
  LEFT JOIN "categories" parent ON parent."id" = category."parent_id"
  WHERE r."event_type" = 'checkout_opened'
    AND i."checked_out_quantity" > 0
), serialized_totals AS (
  SELECT i."booking_id", COUNT(*)::int AS total
  FROM "booking_serialized_items" i
  GROUP BY i."booking_id"
), bulk_totals AS (
  SELECT i."booking_id", COALESCE(SUM(i."checked_out_quantity"), 0)::int AS total
  FROM "booking_bulk_items" i
  GROUP BY i."booking_id"
), credited_booking_totals AS (
  SELECT
    r."user_id",
    r."source_key" AS booking_id,
    COALESCE(serialized.total, 0) + COALESCE(bulk.total, 0) AS item_total
  FROM "badge_event_receipts" r
  JOIN "bookings" b ON b."id" = r."source_key"
  LEFT JOIN serialized_totals serialized ON serialized."booking_id" = b."id"
  LEFT JOIN bulk_totals bulk ON bulk."booking_id" = b."id"
  WHERE r."event_type" = 'checkout_opened'
    AND b."kind" = 'CHECKOUT'::"BookingKind"
    AND b."status" IN ('OPEN'::"BookingStatus", 'COMPLETED'::"BookingStatus")
), full_rig_checkouts AS (
  SELECT c."user_id", c.booking_id
  FROM credited_booking_categories c
  WHERE c.family_name IN ('cameras', 'lenses', 'audio')
  GROUP BY c."user_id", c.booking_id
  HAVING COUNT(DISTINCT c.family_name) = 3
), five_family_checkouts AS (
  SELECT c."user_id", c.booking_id
  FROM credited_booking_categories c
  GROUP BY c."user_id", c.booking_id
  HAVING COUNT(DISTINCT c.family_name) >= 5
), rule_counts AS (
  SELECT c."user_id", 'checkout_family_batteries' AS rule_key, COUNT(DISTINCT c.booking_id)::int AS total
  FROM credited_booking_categories c WHERE c.family_name = 'batteries' GROUP BY c."user_id"
  UNION ALL
  SELECT c."user_id", 'checkout_family_lenses', COUNT(DISTINCT c.booking_id)::int
  FROM credited_booking_categories c WHERE c.family_name = 'lenses' GROUP BY c."user_id"
  UNION ALL
  SELECT c."user_id", 'checkout_family_audio', COUNT(DISTINCT c.booking_id)::int
  FROM credited_booking_categories c WHERE c.family_name = 'audio' GROUP BY c."user_id"
  UNION ALL
  SELECT c."user_id", 'checkout_support', COUNT(DISTINCT c.booking_id)::int
  FROM credited_booking_categories c WHERE c.family_name IN ('tripods', 'gimbal') GROUP BY c."user_id"
  UNION ALL
  SELECT c."user_id", 'checkout_family_lighting', COUNT(DISTINCT c.booking_id)::int
  FROM credited_booking_categories c WHERE c.family_name = 'lighting' GROUP BY c."user_id"
  UNION ALL
  SELECT c."user_id", 'checkout_families_5', COUNT(*)::int
  FROM five_family_checkouts c GROUP BY c."user_id"
  UNION ALL
  SELECT c."user_id", 'checkout_full_rig', COUNT(*)::int
  FROM full_rig_checkouts c GROUP BY c."user_id"
  UNION ALL
  SELECT c."user_id", 'checkout_items_15', COUNT(*)::int
  FROM credited_booking_totals c WHERE c.item_total >= 15 GROUP BY c."user_id"
)
INSERT INTO "student_badges" ("id", "user_id", "definition_id")
SELECT
  'badge_backfill_' || md5(c."user_id" || ':' || d."id"),
  c."user_id",
  d."id"
FROM rule_counts c
JOIN "badge_definitions" d
  ON d."active" = true
  AND d."rule_key" = c.rule_key
  AND d."threshold" <= c.total
ON CONFLICT ("user_id", "definition_id") DO NOTHING;

-- Repair any already-completed on-time streak thresholds. Scan streak rows are
-- deliberately retained as history but no longer drive active definitions.
INSERT INTO "student_badges" ("id", "user_id", "definition_id")
SELECT
  'badge_backfill_' || md5(s."user_id" || ':' || d."id"),
  s."user_id",
  d."id"
FROM "badge_streaks" s
JOIN "badge_definitions" d
  ON d."active" = true
  AND d."rule_key" = 'on_time_return_streak'
  AND d."threshold" <= s."current"
WHERE s."streak_type" = 'ON_TIME_RETURN'::"BadgeStreakType"
ON CONFLICT ("user_id", "definition_id") DO NOTHING;
