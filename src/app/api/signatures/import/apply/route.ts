import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { enforceRateLimit, SIGNATURE_MUTATION_LIMIT } from "@/lib/rate-limit";
import { applySignatureRosterSnapshot } from "@/lib/services/signatures";
import { signatureApplySchema } from "@/lib/signatures/types";

export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "signature", "reconcile");
  await enforceRateLimit(`signature-reconcile:${user.id}`, SIGNATURE_MUTATION_LIMIT);
  const body = signatureApplySchema.parse(await req.json());
  return ok(await applySignatureRosterSnapshot({ actor: user, ...body }));
});
