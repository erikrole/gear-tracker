import { withAuth } from "@/lib/api";
import { HttpError } from "@/lib/http";
import { enforceRateLimit, SETTINGS_MUTATION_LIMIT } from "@/lib/rate-limit";
import { requireRole } from "@/lib/rbac";

export const POST = withAuth(async (req, { user }) => {
  requireRole(user.role, ["ADMIN", "STAFF"]);
  await enforceRateLimit(`users:bulk-create:${user.id}`, SETTINGS_MUTATION_LIMIT);
  throw new HttpError(
    410,
    "Temporary-password bulk onboarding has been retired. Add emails to the allowlist so users can register and set their own passwords."
  );
});
