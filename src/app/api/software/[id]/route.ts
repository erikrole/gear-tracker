import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { enforceRateLimit, SETTINGS_MUTATION_LIMIT } from "@/lib/rate-limit";
import {
  archiveSoftwareCredential,
  updateSoftwareCredential,
} from "@/lib/services/software";
import { updateSoftwareCredentialSchema } from "@/lib/software-vault-validation";

export const PATCH = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "software", "manage");
  await enforceRateLimit(`software:write:${user.id}`, SETTINGS_MUTATION_LIMIT);
  const body = updateSoftwareCredentialSchema.parse(await req.json());
  const credential = await updateSoftwareCredential(params.id, body, {
    id: user.id,
    role: user.role,
  });

  return ok({ data: credential });
});

export const DELETE = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "software", "manage");
  await enforceRateLimit(`software:write:${user.id}`, SETTINGS_MUTATION_LIMIT);
  const credential = await archiveSoftwareCredential(params.id, {
    id: user.id,
    role: user.role,
  });

  return ok({ data: credential });
});
