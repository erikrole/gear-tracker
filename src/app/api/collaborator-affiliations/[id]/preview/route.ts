import { CollaboratorPolicyStatus } from "@prisma/client";
import { z } from "zod";
import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { previewCollaboratorPolicyChange } from "@/lib/services/collaborator-policies";

const previewSchema = z.object({
  status: z.nativeEnum(CollaboratorPolicyStatus).optional(),
  capabilities: z.array(z.string()).max(20).optional(),
});

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "collaborator_policy", "view");
  const body = previewSchema.parse(await req.json());
  return ok({ data: await previewCollaboratorPolicyChange({ policyId: params.id, ...body }) });
});
