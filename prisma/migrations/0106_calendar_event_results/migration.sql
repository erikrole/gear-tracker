-- Preserve source-derived W-L outcomes separately from the cleaned event title.
-- Only synced rows are eligible, and existing raw titles are the sole backfill
-- evidence. Historical rows without a captured marker remain unknown.

CREATE TYPE "CalendarEventResult" AS ENUM ('WIN', 'LOSS');

ALTER TABLE "calendar_events"
ADD COLUMN "result" "CalendarEventResult";

UPDATE "calendar_events"
SET "result" = CASE
  WHEN "raw_summary" ~* '^\s*\[W\](\s|$)' THEN 'WIN'::"CalendarEventResult"
  WHEN "raw_summary" ~* '^\s*\[L\](\s|$)' THEN 'LOSS'::"CalendarEventResult"
  ELSE NULL
END
WHERE "source_id" IS NOT NULL
  AND "raw_summary" ~* '^\s*\[(W|L)\](\s|$)';
