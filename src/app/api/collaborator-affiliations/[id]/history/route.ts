import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { listCollaboratorPolicyHistory } from "@/lib/services/collaborator-policies";

export const GET = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "collaborator_policy", "view");
  return ok({ data: await listCollaboratorPolicyHistory(params.id) });
});
