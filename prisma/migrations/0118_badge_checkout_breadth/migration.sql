-- Five automatic checkout badges: three visible challenges for inventory
-- breadth, week-over-week rhythm, and kit use, plus two hidden surprises for
-- loyalty to one item and the all-battery run. Every rule reads credited
-- checkout receipts, so ownership transfer cannot move or duplicate credit.

INSERT INTO "badge_definitions" (
  "id", "key", "name", "description", "icon",
  "category", "kind", "trigger", "threshold", "rule_key", "active", "sort_order"
)
VALUES
  ('seed_badge_deep_inventory', 'deep_inventory', 'Deep Inventory', 'Checked out 25 different serialized items.', 'Warehouse', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:opened', 25, 'checkout_distinct_assets', true, 890),
  ('seed_badge_regular_rotation', 'regular_rotation', 'Regular Rotation', 'Opened checkouts in six different weeks.', 'CalendarRange', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:opened', 6, 'checkout_weeks', true, 892),
  ('seed_badge_kit_complete', 'kit_complete', 'Kit Complete', 'Opened five checkouts built from a saved kit.', 'PackageOpen', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:opened', 5, 'checkout_from_kit', true, 894),
  ('seed_badge_old_faithful', 'old_faithful', 'Old Faithful', 'Checked out the same item 25 times.', 'Camera', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:opened', 25, 'checkout_same_asset', true, 905),
  ('seed_badge_battery_run', 'battery_run', 'Battery Run', 'Opened five checkouts containing nothing but batteries.', 'BatteryLow', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'checkout:opened', 5, 'checkout_batteries_only', true, 910)
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

-- Backfill historical qualifiers from the same credited rows the evaluator
-- reads. Family names come from the top-level category, and bulk rows count
-- only pieces that were actually handed out, matching `0110_badge_rewards`.
WITH credited_bookings AS (
  SELECT r."user_id", b."id" AS booking_id, b."starts_at", b."kit_id"
  FROM "badge_event_receipts" r
  JOIN "bookings" b ON b."id" = r."source_key"
  WHERE r."event_type" = 'checkout_opened'
    AND b."kind" = 'CHECKOUT'::"BookingKind"
    AND b."status" IN ('OPEN'::"BookingStatus", 'COMPLETED'::"BookingStatus")
), credited_assets AS (
  SELECT DISTINCT c."user_id", c.booking_id, i."asset_id"
  FROM credited_bookings c
  JOIN "booking_serialized_items" i ON i."booking_id" = c.booking_id
), credited_families AS (
  SELECT DISTINCT
    c."user_id",
    c.booking_id,
    LOWER(COALESCE(parent."name", category."name")) AS family_name
  FROM credited_bookings c
  JOIN "booking_serialized_items" i ON i."booking_id" = c.booking_id
  JOIN "assets" a ON a."id" = i."asset_id"
  JOIN "categories" category ON category."id" = a."category_id"
  LEFT JOIN "categories" parent ON parent."id" = category."parent_id"
  UNION
  SELECT DISTINCT
    c."user_id",
    c.booking_id,
    LOWER(COALESCE(parent."name", category."name")) AS family_name
  FROM credited_bookings c
  JOIN "booking_bulk_items" i ON i."booking_id" = c.booking_id
  JOIN "bulk_skus" s ON s."id" = i."bulk_sku_id"
  JOIN "categories" category ON category."id" = s."category_id"
  LEFT JOIN "categories" parent ON parent."id" = category."parent_id"
  WHERE i."checked_out_quantity" > 0
), battery_only_bookings AS (
  SELECT f."user_id", f.booking_id
  FROM credited_families f
  GROUP BY f."user_id", f.booking_id
  HAVING COUNT(*) = 1 AND MIN(f.family_name) = 'batteries'
), asset_repeat_counts AS (
  SELECT a."user_id", a."asset_id", COUNT(DISTINCT a.booking_id)::int AS total
  FROM credited_assets a
  GROUP BY a."user_id", a."asset_id"
), rule_counts AS (
  SELECT a."user_id", 'checkout_distinct_assets' AS rule_key, COUNT(DISTINCT a."asset_id")::int AS total
  FROM credited_assets a
  GROUP BY a."user_id"
  UNION ALL
  SELECT
    c."user_id",
    'checkout_weeks',
    COUNT(DISTINCT DATE_TRUNC(
      'week',
      c."starts_at" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago'
    ))::int
  FROM credited_bookings c
  GROUP BY c."user_id"
  UNION ALL
  SELECT c."user_id", 'checkout_from_kit', COUNT(*)::int
  FROM credited_bookings c
  WHERE c."kit_id" IS NOT NULL
  GROUP BY c."user_id"
  UNION ALL
  SELECT r."user_id", 'checkout_same_asset', MAX(r.total)::int
  FROM asset_repeat_counts r
  GROUP BY r."user_id"
  UNION ALL
  SELECT b."user_id", 'checkout_batteries_only', COUNT(*)::int
  FROM battery_only_bookings b
  GROUP BY b."user_id"
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
