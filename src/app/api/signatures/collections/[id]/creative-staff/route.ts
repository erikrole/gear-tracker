import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { enforceRateLimit, SIGNATURE_MUTATION_LIMIT } from "@/lib/rate-limit";
import { syncSignatureCreativeStaff } from "@/lib/services/signatures";
import { signatureCollectionVersionSchema } from "@/lib/signatures/types";

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "signature", "reconcile");
  await enforceRateLimit(`signature-creative-staff:${user.id}`, SIGNATURE_MUTATION_LIMIT);
  const body = signatureCollectionVersionSchema.parse(await req.json());
  return ok(await syncSignatureCreativeStaff({
    actor: user,
    collectionId: params.id,
    expectedCollectionVersion: body.expectedCollectionVersion,
  }));
});
