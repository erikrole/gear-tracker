-- Record where a game was played as its own dimension.
--
-- `is_home` is a nullable boolean, so a neutral-site game and a game we simply
-- could not classify are both NULL and cannot be told apart. That is fine for a
-- yes/no "are we at home" read and wrong for counting: neutral sites are 28% of
-- synced events, against a handful of genuinely unknown rows.
--
-- `is_home` stays as-is; every reader of it keeps working. Both values are
-- produced by one function (`classifySourceEvent`), so they cannot drift.
--
-- Structure only. Existing rows are classified by
-- `scripts/reclassify-legacy-events.ts`, which derives the value through that
-- same function from each row's stored raw evidence — the sport-label matching
-- involved is not expressible in SQL without copying the sport table here.

CREATE TYPE "CalendarEventSite" AS ENUM ('HOME', 'AWAY', 'NEUTRAL');

ALTER TABLE "calendar_events"
ADD COLUMN "site" "CalendarEventSite";
