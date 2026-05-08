CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "bookings_title_trgm_idx"
  ON "bookings" USING gin ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "bookings_ref_number_trgm_idx"
  ON "bookings" USING gin ("ref_number" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "users_name_trgm_idx"
  ON "users" USING gin ("name" gin_trgm_ops);
