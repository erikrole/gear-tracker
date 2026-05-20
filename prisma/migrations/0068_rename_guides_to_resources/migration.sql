ALTER TABLE "guides" RENAME TO "resources";

ALTER INDEX IF EXISTS "guides_slug_key" RENAME TO "resources_slug_key";
ALTER INDEX IF EXISTS "guides_category_idx" RENAME TO "resources_category_idx";
ALTER INDEX IF EXISTS "guides_published_idx" RENAME TO "resources_published_idx";
ALTER INDEX IF EXISTS "guides_featured_featured_rank_idx" RENAME TO "resources_featured_featured_rank_idx";
ALTER INDEX IF EXISTS "guides_last_verified_at_idx" RENAME TO "resources_last_verified_at_idx";
ALTER INDEX IF EXISTS "guides_last_verified_by_id_idx" RENAME TO "resources_last_verified_by_id_idx";

DO $$
BEGIN
  ALTER TABLE "resources" RENAME CONSTRAINT "guides_author_id_fkey" TO "resources_author_id_fkey";
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "resources" RENAME CONSTRAINT "guides_last_verified_by_id_fkey" TO "resources_last_verified_by_id_fkey";
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;
