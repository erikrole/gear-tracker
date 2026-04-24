import { z } from "zod";
import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";
import { releaseCode } from "@/lib/services/licenses";

const bodySchema = z.object({ claimId: z.string().optional() }).optional();

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "license", "release");
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
