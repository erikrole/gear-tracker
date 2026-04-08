import { destroySession } from "@/lib/auth";
import { ok } from "@/lib/http";
import { withAuth } from "@/lib/api";
import { createAuditEntry } from "@/lib/audit";

export const POST = withAuth(async (_req, { user }) => {
  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "session",
    entityId: user.id,
    action: "logout",
  });

  await destroySession();
  return ok({ success: true });
});
