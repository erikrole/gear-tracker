import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { enforceRateLimit, SIGNATURE_MUTATION_LIMIT } from "@/lib/rate-limit";
import { updateSignatureAthleteProfile } from "@/lib/services/signatures";
import { signatureAthleteProfileSchema } from "@/lib/signatures/types";

export const PATCH = withAuth<{ id: string; memberId: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "signature", "profile");
  await enforceRateLimit(`signature-profile:${user.id}`, SIGNATURE_MUTATION_LIMIT);
  const body = signatureAthleteProfileSchema.parse(await req.json());
  return ok(await updateSignatureAthleteProfile({
    actor: user,
    collectionId: params.id,
    memberId: params.memberId,
    profile: body,
  }));
});
