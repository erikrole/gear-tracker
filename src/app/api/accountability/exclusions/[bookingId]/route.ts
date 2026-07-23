import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { enforceRateLimit, SETTINGS_MUTATION_LIMIT } from "@/lib/rate-limit";
import { restoreBookingToAccountability } from "@/lib/services/accountability";

export const DELETE = withAuth<{ bookingId: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "accountability", "manage_exclusions");
  await enforceRateLimit(`accountability:write:${user.id}`, SETTINGS_MUTATION_LIMIT);
  const exclusion = await restoreBookingToAccountability({
    bookingId: params.bookingId,
    actorId: user.id,
    actorRole: user.role,
  });
  return ok({ data: exclusion });
});
