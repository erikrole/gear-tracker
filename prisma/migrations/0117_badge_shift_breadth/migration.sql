-- Four automatic shift-breadth badges. The v6 catalog recognises how many
-- shifts a person was assigned to, but nothing about the range of that work:
-- how many sports, how many crew areas, how many two-shift days, and how many
-- nights ran long. All four derive from confirmed ended assignments the
-- schedule already stores. No new event source and no new column.

INSERT INTO "badge_definitions" (
  "id", "key", "name", "description", "icon",
  "category", "kind", "trigger", "threshold", "rule_key", "active", "sort_order"
)
VALUES
  ('seed_badge_season_pass', 'season_pass', 'Season Pass', 'Was assigned to completed shifts across four different sports.', 'Ticket', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'shift:completed', 4, 'shift_sports', true, 870),
  ('seed_badge_utility_crew', 'utility_crew', 'Utility Crew', 'Was assigned to completed shifts in five different crew areas.', 'Shuffle', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'shift:completed', 5, 'shift_areas', true, 875),
  ('seed_badge_doubleheader', 'doubleheader', 'Doubleheader', 'Was assigned to two or more completed shifts on the same day.', 'Repeat2', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'shift:completed', 1, 'shift_doubleheader_days', true, 880),
  ('seed_badge_under_the_lights', 'under_the_lights', 'Under the Lights', 'Was assigned to eight completed shifts that ran to 10 p.m. or later.', 'Sunset', 'MILESTONE'::"BadgeCategory", 'COUNT'::"BadgeKind", 'shift:completed', 8, 'shift_after_22', true, 885)
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

-- Backfill historical qualifiers so the catalog does not launch with four
-- badges that nobody holds despite having earned them years ago. Mirrors the
-- assignment scope the nightly evaluator uses: confirmed events that have
-- already ended, held by an assignment that was not declined or swapped away.
-- Archived events still count, matching `onShiftsWorked`.
WITH assignment_facts AS (
  SELECT
    sa."user_id",
    e."sport_code",
    s."area",
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
), rule_counts AS (
  SELECT f."user_id", 'shift_sports' AS rule_key, COUNT(DISTINCT LOWER(BTRIM(f."sport_code")))::int AS total
  FROM assignment_facts f
  WHERE NULLIF(BTRIM(f."sport_code"), '') IS NOT NULL
  GROUP BY f."user_id"
  UNION ALL
  SELECT f."user_id", 'shift_areas', COUNT(DISTINCT f."area")::int
  FROM assignment_facts f
  GROUP BY f."user_id"
  UNION ALL
  SELECT d."user_id", 'shift_doubleheader_days', COUNT(*)::int
  FROM doubleheader_days d
  GROUP BY d."user_id"
  UNION ALL
  -- A shift that crossed local midnight was still running during the 11 p.m.
  -- hour, so it qualifies without its end hour reaching 22.
  SELECT f."user_id", 'shift_after_22', COUNT(*)::int
  FROM assignment_facts f
  WHERE EXTRACT(HOUR FROM f.local_end) >= 22
     OR f.local_end::date > f.local_start::date
  GROUP BY f."user_id"
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
