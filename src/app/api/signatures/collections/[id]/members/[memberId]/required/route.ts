import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { enforceRateLimit, SIGNATURE_MUTATION_LIMIT } from "@/lib/rate-limit";
import { updateSignatureMemberRequired } from "@/lib/services/signatures";
import { signatureRequiredUpdateSchema } from "@/lib/signatures/types";

export const PATCH = withAuth<{ id: string; memberId: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "signature", "required");
  await enforceRateLimit(`signature-required:${user.id}`, SIGNATURE_MUTATION_LIMIT);
  const body = signatureRequiredUpdateSchema.parse(await req.json());
  return ok(await updateSignatureMemberRequired({ actor: user, collectionId: params.id, memberId: params.memberId, ...body }));
});
