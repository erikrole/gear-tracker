-- Create favorite_items table for user bookmarks/pins
CREATE TABLE "favorite_items" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorite_items_pkey" PRIMARY KEY ("id")
);

-- Each user can only favorite an asset once
CREATE UNIQUE INDEX "favorite_items_user_id_asset_id_key" ON "favorite_items"("user_id", "asset_id");

-- Index for efficient lookup of a user's favorites
CREATE INDEX "favorite_items_user_id_idx" ON "favorite_items"("user_id");

-- Foreign keys with cascade deletes
ALTER TABLE "favorite_items"
    ADD CONSTRAINT "favorite_items_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "favorite_items"
    ADD CONSTRAINT "favorite_items_asset_id_fkey"
    FOREIGN KEY ("asset_id") REFERENCES "assets"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
