import { z } from "zod";
import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { enforceRateLimit, SETTINGS_MUTATION_LIMIT } from "@/lib/rate-limit";
import {
  createCollaboratorAffiliation,
  getCollaboratorPolicy,
  listCollaboratorPolicies,
} from "@/lib/services/collaborator-policies";

const createSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  badgeLabel: z.string().trim().min(2).max(12),
});

export const GET = withAuth(async (_req, { user }) => {
  requirePermission(user.role, "collaborator_policy", "view");
  return ok({
    data: await listCollaboratorPolicies(),
  });
});

export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "collaborator_policy", "manage");
  await enforceRateLimit(`collaborator-policy:create:${user.id}`, SETTINGS_MUTATION_LIMIT);
  const body = createSchema.parse(await req.json());
  const policyId = await createCollaboratorAffiliation({ actor: user, ...body });
  return ok({ data: await getCollaboratorPolicy(policyId) }, 201);
});
