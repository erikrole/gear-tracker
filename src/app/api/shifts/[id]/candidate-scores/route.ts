import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requireRole } from "@/lib/rbac";
import { getCandidateScoresForShift } from "@/lib/services/candidate-scoring";

export const GET = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requireRole(user.role, ["ADMIN", "STAFF"]);

  const scores = await getCandidateScoresForShift(params.id);

  return ok({ data: scores });
});
