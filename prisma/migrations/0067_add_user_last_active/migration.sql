-- Add user-level activity tracking for Users roster visibility.
ALTER TABLE "users" ADD COLUMN "last_active_at" TIMESTAMP(3);
