-- Enable pg_trgm extension for ILIKE '%query%' index support
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram indexes for asset text search (ILIKE on name, brand, model, asset_tag)
-- These enable indexed ILIKE '%query%' queries instead of sequential scans
CREATE INDEX CONCURRENTLY IF NOT EXISTS "assets_name_trgm_idx" ON "assets" USING gin ("name" gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "assets_brand_trgm_idx" ON "assets" USING gin ("brand" gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "assets_model_trgm_idx" ON "assets" USING gin ("model" gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "assets_asset_tag_trgm_idx" ON "assets" USING gin ("asset_tag" gin_trgm_ops);

-- GIN trigram index for booking title search
CREATE INDEX CONCURRENTLY IF NOT EXISTS "bookings_title_trgm_idx" ON "bookings" USING gin ("title" gin_trgm_ops);
