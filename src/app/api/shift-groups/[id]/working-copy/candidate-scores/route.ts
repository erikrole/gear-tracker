import { z } from "zod";
import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { getWorkingScheduleCandidateScores } from "@/lib/services/schedule-working-copy";

const querySchema = z.object({
  slotKey: z.string().min(1),
});

export const GET = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "shift", "manage");
  const query = querySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return ok({ data: await getWorkingScheduleCandidateScores(params.id, query.slotKey) });
});
