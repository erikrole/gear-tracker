import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { enforceRateLimit, SIGNATURE_MUTATION_LIMIT } from "@/lib/rate-limit";
import { cleanupPendingSignatureArtifacts } from "@/lib/services/signatures";

export const POST = withAuth(async (_req, { user }) => {
  requirePermission(user.role, "signature", "cleanup");
  await enforceRateLimit(`signature-cleanup:${user.id}`, SIGNATURE_MUTATION_LIMIT);
  return ok(await cleanupPendingSignatureArtifacts());
});
