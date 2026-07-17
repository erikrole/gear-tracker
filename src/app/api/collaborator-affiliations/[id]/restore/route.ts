import { z } from "zod";
import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { enforceRateLimit, SETTINGS_MUTATION_LIMIT } from "@/lib/rate-limit";
import { getCollaboratorPolicy, restoreCollaboratorPolicy } from "@/lib/services/collaborator-policies";

const restoreSchema = z.object({
  revisionId: z.string().min(1).max(100),
  expectedVersion: z.number().int().positive(),
  acknowledgeRisk: z.boolean().optional(),
});

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "collaborator_policy", "manage");
  await enforceRateLimit(`collaborator-policy:restore:${user.id}`, SETTINGS_MUTATION_LIMIT);
  const body = restoreSchema.parse(await req.json());
  await restoreCollaboratorPolicy({ actor: user, policyId: params.id, ...body });
  return ok({ data: await getCollaboratorPolicy(params.id) });
});
