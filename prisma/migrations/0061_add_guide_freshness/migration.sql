ALTER TABLE "guides"
  ADD COLUMN IF NOT EXISTS "last_verified_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_verified_by_id" TEXT;

CREATE INDEX IF NOT EXISTS "guides_last_verified_at_idx" ON "guides"("last_verified_at");
CREATE INDEX IF NOT EXISTS "guides_last_verified_by_id_idx" ON "guides"("last_verified_by_id");

DO $$
BEGIN
  ALTER TABLE "guides"
    ADD CONSTRAINT "guides_last_verified_by_id_fkey"
    FOREIGN KEY ("last_verified_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
