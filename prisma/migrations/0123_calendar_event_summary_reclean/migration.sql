-- Re-clean stored titles on synced events that the feed no longer lists.
--
-- `cleanSourceSummary` strips the source W-L/neutral marker, the team-name
-- prefix, and a trailing event-type suffix before a title is stored. Rows
-- imported before that cleaning existed still hold the raw text, so the
-- schedule shows titles like "[L] Wisconsin Athletics Softball vs Baylor".
-- Sync cannot repair them: a past game eventually drops out of the ICS feed,
-- and only rows present in the feed are re-derived.
--
-- Mirrors `cleanSourceSummary` (src/lib/schedule-event-identity.ts):
--   1. leading single-letter marker, e.g. "[W] ", "[L] ", "[N] "
--   2. "Wisconsin Athletics" / "Wisconsin Badgers" prefix and any separator
--   3. trailing "(home|away|neutral|exhibition|scrimmage)"
--   4. whitespace collapse
--
-- Only synced rows, and never a manually locked title. Idempotent: a second run
-- matches nothing. A transform that would empty a title leaves it untouched.
--
-- Bounded to events before 2026-07-01 per the agreed backfill cutoff. Later
-- events are still in the feed, so sync re-derives their titles on its own.

WITH cleaned AS (
  SELECT
    "id",
    "summary",
    NULLIF(btrim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
      "summary", '^\s*\[[A-Za-z]\]\s*', ''),
      '^(Wisconsin Athletics|Wisconsin Badgers)\s*[-–—:]?\s*', ''),
      '\s*\((home|away|neutral|exhibition|scrimmage)\)\s*$', '', 'i'),
      '\s+', ' ', 'g')), '') AS next_summary
  FROM "calendar_events"
  WHERE "source_id" IS NOT NULL
    AND "summary_locked" = false
    AND "starts_at" < DATE '2026-07-01'
)
UPDATE "calendar_events" e
SET "summary" = c.next_summary
FROM cleaned c
WHERE e."id" = c."id"
  AND c.next_summary IS NOT NULL
  AND c.next_summary <> e."summary";
