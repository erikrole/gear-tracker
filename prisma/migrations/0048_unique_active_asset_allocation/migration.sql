-- 0048_unique_active_asset_allocation
-- Move this file to: prisma/migrations/0048_unique_active_asset_allocation/migration.sql
--
-- Enforce at the DB layer that an asset can have at most one active
-- allocation row at a time. Closes the cross-flow double-checkout race
-- that no application-layer guard can fully prevent (audit 2026-04-29,
-- Bigger Bet #2).
--
-- Pre-flight: fail loudly if duplicate active allocations already exist.
-- If this raises, resolve duplicates before re-applying.

DO $$
DECLARE
    dupe_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO dupe_count FROM (
        SELECT asset_id
        FROM asset_allocations
        WHERE active = TRUE
        GROUP BY asset_id
        HAVING COUNT(*) > 1
    ) AS dupes;

    IF dupe_count > 0 THEN
        RAISE EXCEPTION
            'Cannot create unique active-allocation index: % asset(s) currently have multiple active allocations. Resolve duplicates first.',
            dupe_count;
    END IF;
END $$;

CREATE UNIQUE INDEX "asset_allocations_asset_id_active_unique"
    ON "asset_allocations" ("asset_id")
    WHERE "active" = TRUE;
