-- Move this file to: prisma/migrations/0049_audit_log_created_at_index/migration.sql
-- (Claude is blocked from writing under prisma/migrations/ by .claude/settings.json)
-- Or run:  npx prisma migrate dev --create-only --name audit_log_created_at_index
-- and replace the generated SQL body with the contents below.

-- Backs the weekly retention cron (`/api/cron/audit-archive`) which scans
-- audit_logs WHERE created_at < cutoff. The existing composite indexes are
-- leading on entity_type / actor_user_id, so neither serves a created_at-only
-- range scan — full sequential scan today.
--
-- CONCURRENTLY so the migration doesn't take an ACCESS EXCLUSIVE lock on a
-- table that's written on every mutation.

CREATE INDEX CONCURRENTLY IF NOT EXISTS "audit_logs_created_at_idx"
  ON "audit_logs" ("created_at");
