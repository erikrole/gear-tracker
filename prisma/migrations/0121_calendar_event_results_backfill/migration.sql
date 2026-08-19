-- Re-run the 0106 outcome backfill.
--
-- 0106 added `result` and populated it once from the source W-L marker, but no
-- application code wrote the column afterward, so every game that finished
-- between that migration and the sync writer landing kept a marker in
-- `raw_summary` with `result` still NULL. Calendar sync now writes the column
-- going forward; this closes the gap it could not reach, because a past event
-- eventually drops out of the ICS feed and is never re-synced.
--
-- Same predicate and same evidence as 0106: only synced rows, and only the
-- captured raw title. Idempotent — rows that already carry a result keep it,
-- and a row without a marker stays unknown rather than becoming a loss.
--
-- Bounded to games before 2026-07-01 per the agreed backfill cutoff. Anything
-- on or after that date is left to ICS sync, which now writes the column and
-- still sees those games in the feed.

UPDATE "calendar_events"
SET "result" = CASE
  WHEN "raw_summary" ~* '^\s*\[W\](\s|$)' THEN 'WIN'::"CalendarEventResult"
  WHEN "raw_summary" ~* '^\s*\[L\](\s|$)' THEN 'LOSS'::"CalendarEventResult"
  ELSE NULL
END
WHERE "source_id" IS NOT NULL
  AND "result" IS NULL
  AND "starts_at" < DATE '2026-07-01'
  AND "raw_summary" ~* '^\s*\[(W|L)\](\s|$)';
