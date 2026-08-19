import { withAuth } from "@/lib/api";
import { ok, HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { revealSoftwarePassword } from "@/lib/services/software";

const REVEAL_LIMIT = { max: 20, windowMs: 5 * 60_000 };

export const GET = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "software", "reveal");
  const { allowed } = await checkRateLimit(`software:reveal:${user.id}`, REVEAL_LIMIT);
  if (!allowed) throw new HttpError(429, "Too many password reveals. Please wait a few minutes.");

  const credential = await revealSoftwarePassword(params.id);
  // Audit before returning the secret so an audit failure cannot silently turn
  // a credential read into an untracked read.
  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "software_credential",
    entityId: credential.id,
    action: "reveal_password",
    after: { name: credential.name },
  });

  return ok({ data: { password: credential.password } });
});
