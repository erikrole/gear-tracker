import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { enforceRateLimit, SIGNATURE_MUTATION_LIMIT } from "@/lib/rate-limit";
import { createAdHocSignatureMember, listSignatureCollections } from "@/lib/services/signatures";
import { signatureAdHocMemberSchema } from "@/lib/signatures/types";

export const GET = withAuth(async (req, { user }) => {
  requirePermission(user.role, "signature", "view");
  const includeArchived = user.role === "ADMIN" && new URL(req.url).searchParams.get("includeArchived") === "true";
  return ok({ collections: await listSignatureCollections({ includeArchived }) });
});

export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "signature", "reconcile");
  await enforceRateLimit(`signature-ad-hoc:${user.id}`, SIGNATURE_MUTATION_LIMIT);
  const body = signatureAdHocMemberSchema.parse(await req.json());
  return ok(await createAdHocSignatureMember({ actor: user, ...body }));
});
