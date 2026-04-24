import { withAuth } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { claimCode } from "@/lib/services/licenses";

const CLAIM_LIMIT = { max: 10, windowMs: 60_000 }; // 10/min per user

export const POST = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "license", "claim");
  const { allowed } = checkRateLimit(`license:claim:${user.id}`, CLAIM_LIMIT);
  if (!allowed) throw new HttpError(429, "Too many claim attempts. Please wait a moment.");
  const code = await claimCode(params.id, user.id);

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "license_code",
    entityId: params.id,
    action: "claim",
    after: { userId: user.id, status: code.status, at: new Date().toISOString() },
  });

  return ok({ data: { id: code.id, code: code.code } });
});
