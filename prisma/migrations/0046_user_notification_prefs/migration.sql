-- Per-user notification preferences. Nullable JSON; null = receive everything,
-- which matches existing dispatch behavior so no data backfill is needed.
ALTER TABLE "users" ADD COLUMN "notification_prefs" JSONB;
