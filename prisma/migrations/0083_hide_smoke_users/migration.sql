-- Add a visibility flag for smoke/test identities that must stay out of
-- normal roster, export, and picker workflows.
ALTER TABLE "users" ADD COLUMN "hidden_from_roster" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "users_active_hidden_from_roster_idx" ON "users"("active", "hidden_from_roster");
