-- Per-user ICS subscription token for calendar feed access without session auth.
ALTER TABLE "users" ADD COLUMN "ics_token" TEXT UNIQUE;
