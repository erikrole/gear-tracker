import { z } from "zod";
import { withAuth } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { releaseCode } from "@/lib/services/licenses";

const bodySchema = z.object({ claimId: z.string().optional() }).optional();
const RELEASE_LIMIT = { max: 20, windowMs: 60_000 };

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "license", "release");
  const { allowed } = checkRateLimit(`license:release:${user.id}`, RELEASE_LIMIT);
  if (!allowed) throw new HttpError(429, "Too many requests. Please wait a moment.");
  const isAdmin = user.role === "ADMIN" || user.role === "STAFF";

  let claimId: string | undefined;
  try {
    const body = bodySchema.parse(await req.json());
    claimId = body?.claimId;
  } catch {
    // empty body is fine
  }

  const code = await releaseCode(params.id, user.id, isAdmin, claimId);

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "license_code",
    entityId: params.id,
    action: "release",
    after: { status: code.status, claimId, releasedById: isAdmin ? user.id : null },
  });

  return ok({ data: code });
});
