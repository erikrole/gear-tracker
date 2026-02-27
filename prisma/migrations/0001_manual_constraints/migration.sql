-- Manual PostgreSQL constraints that Prisma cannot express directly.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE asset_allocations
  ADD CONSTRAINT asset_allocations_no_overlap
  EXCLUDE USING gist (
    asset_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  )
  WHERE (active = true);
