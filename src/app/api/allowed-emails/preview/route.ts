import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAllowedEmailBulkSchema } from "@/lib/validation";
import { enforceRateLimit, SETTINGS_MUTATION_LIMIT } from "@/lib/rate-limit";
import { previewAllowedEmailInvitesBulk } from "@/lib/services/onboarding-lifecycle";

export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "allowed_email", "create");
  await enforceRateLimit(`allowed-emails:preview:${user.id}`, SETTINGS_MUTATION_LIMIT);

  const body = await req.json();
  const { emails } = createAllowedEmailBulkSchema.parse(body);
  const result = await previewAllowedEmailInvitesBulk({ actor: user, emails });

  return ok(result);
});
