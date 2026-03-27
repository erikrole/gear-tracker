-- Performance indexes identified by database audit (2026-03-27)

-- CRITICAL: Dashboard queries filter by kind + status + endsAt (overdue detection, cron)
CREATE INDEX "bookings_kind_status_ends_at_idx" ON "bookings"("kind", "status", "ends_at");

-- CRITICAL: Dashboard queries filter by kind + status + requesterUserId + ORDER BY endsAt
CREATE INDEX "bookings_kind_status_requester_user_id_ends_at_idx" ON "bookings"("kind", "status", "requester_user_id", "ends_at");

-- HIGH: Calendar overlap queries without locationId filter
CREATE INDEX "bookings_starts_at_ends_at_idx" ON "bookings"("starts_at", "ends_at");

-- MEDIUM: Drafts queries filter by createdBy + status
CREATE INDEX "bookings_created_by_status_idx" ON "bookings"("created_by", "status");

-- HIGH: Availability checking filters allocations by asset + active + date range
CREATE INDEX "asset_allocations_asset_id_active_starts_at_ends_at_idx" ON "asset_allocations"("asset_id", "active", "starts_at", "ends_at");

-- HIGH: Assets page fires 5 count queries by status
CREATE INDEX "assets_status_idx" ON "assets"("status");

-- Remove redundant index (primaryScanCode already has @unique which creates an index)
DROP INDEX IF EXISTS "assets_primary_scan_code_idx";
