import { randomBytes } from "crypto";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok } from "@/lib/http";
import { createAuditEntry } from "@/lib/audit";

// Returns the current user's existing ICS token (null if none generated yet).
export const GET = withAuth(async (_req, { user }) => {
  const row = await db.user.findUnique({
    where: { id: user.id },
    select: { icsToken: true },
  });
  return ok({ data: { token: row?.icsToken ?? null } });
});

// Generate or rotate the current user's ICS subscription token. Rotating
// invalidates the previous URL — if a user accidentally shared their
// calendar feed (Google Calendar shared with a household, screenshot in
// Slack, etc.), this is the recovery path.
export const POST = withAuth(async (_req, { user }) => {
  const token = randomBytes(24).toString("hex");
  await db.user.update({
    where: { id: user.id },
    data: { icsToken: token },
  });
  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "user",
    entityId: user.id,
    action: "ics_token_rotated",
  });
  return ok({ data: { token } });
});
