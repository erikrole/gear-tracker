ALTER TABLE "guides"
  ADD COLUMN IF NOT EXISTS "target_roles" "Role"[] NOT NULL DEFAULT ARRAY[]::"Role"[],
  ADD COLUMN IF NOT EXISTS "target_areas" "ShiftArea"[] NOT NULL DEFAULT ARRAY[]::"ShiftArea"[],
  ADD COLUMN IF NOT EXISTS "featured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "featured_rank" INTEGER;

CREATE INDEX IF NOT EXISTS "guides_featured_featured_rank_idx" ON "guides"("featured", "featured_rank");
