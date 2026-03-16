-- Add parent-child (accessory) relationship to assets
ALTER TABLE "assets" ADD COLUMN "parent_asset_id" TEXT;

-- Self-referential FK: on parent delete, unlink children (SET NULL)
ALTER TABLE "assets"
  ADD CONSTRAINT "assets_parent_asset_id_fkey"
  FOREIGN KEY ("parent_asset_id") REFERENCES "assets"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Index for efficient child lookups
CREATE INDEX "assets_parent_asset_id_idx" ON "assets"("parent_asset_id");
