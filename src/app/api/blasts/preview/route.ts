import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { enforceRateLimit, SETTINGS_MUTATION_LIMIT } from "@/lib/rate-limit";
import { previewBlastSchema } from "@/lib/validation";
import { resolveBlastTargets, type BlastTargetSpec } from "@/lib/services/blast-targeting";

/**
 * Dry-run target resolution. Nothing is written and nothing is audited -- this is
 * what lets the compose form show who a blast will actually reach before anyone
 * commits to a fan-out that cannot be recalled.
 */
export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "blast", "create");
  await enforceRateLimit(`blasts:preview:${user.id}`, SETTINGS_MUTATION_LIMIT);

  const body = previewBlastSchema.parse(await req.json());
  const target = await resolveBlastTargets(body.target as BlastTargetSpec);

  return ok({
    data: {
      count: target.userIds.length,
      summary: target.summary,
      users: target.users,
    },
  });
});
