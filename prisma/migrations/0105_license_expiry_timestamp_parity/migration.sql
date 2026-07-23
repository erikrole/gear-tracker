-- Reconcile the manually introduced expiry column with Prisma's DateTime
-- storage contract. Migration 0104 deliberately preserved an existing column,
-- which exposed that the live column used timestamptz(6) while Prisma and the
-- empty-database baseline use timestamp(3) without time zone.

DO $$
DECLARE
  current_type TEXT;
  current_precision INTEGER;
BEGIN
  SELECT "data_type", "datetime_precision"
  INTO current_type, current_precision
  FROM "information_schema"."columns"
  WHERE "table_schema" = 'public'
    AND "table_name" = 'license_codes'
    AND "column_name" = 'expires_at';

  IF current_type IS NULL THEN
    RAISE EXCEPTION 'Cannot reconcile license expiry timestamp: expires_at is missing';
  ELSIF current_type = 'timestamp with time zone' THEN
    ALTER TABLE "license_codes"
      ALTER COLUMN "expires_at" TYPE TIMESTAMP(3) WITHOUT TIME ZONE
      USING ("expires_at" AT TIME ZONE 'UTC');
  ELSIF current_type = 'timestamp without time zone'
    AND current_precision IS DISTINCT FROM 3
  THEN
    ALTER TABLE "license_codes"
      ALTER COLUMN "expires_at" TYPE TIMESTAMP(3) WITHOUT TIME ZONE;
  ELSIF current_type <> 'timestamp without time zone' THEN
    RAISE EXCEPTION
      'Cannot reconcile license expiry timestamp: unexpected type %',
      current_type;
  END IF;
END
$$;
