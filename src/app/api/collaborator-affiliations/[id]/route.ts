import { CollaboratorPolicyStatus } from "@prisma/client";
import { z } from "zod";
import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { enforceRateLimit, SETTINGS_MUTATION_LIMIT } from "@/lib/rate-limit";
import {
  archiveCollaboratorAffiliation,
  getCollaboratorPolicy,
  updateCollaboratorPolicy,
} from "@/lib/services/collaborator-policies";

const updateSchema = z.object({
  expectedVersion: z.number().int().positive(),
  displayName: z.string().trim().min(1).max(80).optional(),
  badgeLabel: z.string().trim().min(2).max(12).optional(),
  status: z.nativeEnum(CollaboratorPolicyStatus).optional(),
  capabilities: z.array(z.string()).max(20).optional(),
  acknowledgeRisk: z.boolean().optional(),
});

const archiveSchema = z.object({ expectedVersion: z.number().int().positive() });

export const GET = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "collaborator_policy", "view");
  return ok({ data: await getCollaboratorPolicy(params.id) });
});

export const PATCH = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "collaborator_policy", "manage");
  await enforceRateLimit(`collaborator-policy:update:${user.id}`, SETTINGS_MUTATION_LIMIT);
  const body = updateSchema.parse(await req.json());
  await updateCollaboratorPolicy({ actor: user, policyId: params.id, ...body });
  return ok({ data: await getCollaboratorPolicy(params.id) });
});

export const DELETE = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "collaborator_policy", "manage");
  await enforceRateLimit(`collaborator-policy:archive:${user.id}`, SETTINGS_MUTATION_LIMIT);
  const body = archiveSchema.parse(await req.json());
  return ok(await archiveCollaboratorAffiliation({ actor: user, policyId: params.id, ...body }));
});
