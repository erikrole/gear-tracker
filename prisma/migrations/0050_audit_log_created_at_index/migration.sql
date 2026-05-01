-- Backs the weekly retention cron (`/api/cron/audit-archive`).
  -- Not CONCURRENTLY because Prisma wraps each migration in a transaction.
  CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx"
    ON "audit_logs" ("created_at");