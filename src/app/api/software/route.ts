import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission, requirePermissionOrCollaboratorCapability } from "@/lib/rbac";
import { enforceRateLimit, SETTINGS_MUTATION_LIMIT } from "@/lib/rate-limit";
import {
  createSoftwareCredential,
  listSoftwareCredentials,
} from "@/lib/services/software";
import { createSoftwareCredentialSchema } from "@/lib/software-vault-validation";

export const GET = withAuth(async (req, { user }) => {
  requirePermissionOrCollaboratorCapability(user, "software", "view", "SOFTWARE_VAULT_VIEW");
  const canManage = user.role === "ADMIN" || user.role === "STAFF";
  const includeArchived = canManage && new URL(req.url).searchParams.get("includeArchived") === "1";
  const data = await listSoftwareCredentials({
    includeArchived,
    role: user.role,
    collaboratorCanView: user.role === "COLLABORATOR",
  });
  return ok({ data });
});

export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "software", "manage");
  await enforceRateLimit(`software:write:${user.id}`, SETTINGS_MUTATION_LIMIT);
  const body = createSoftwareCredentialSchema.parse(await req.json());
  const credential = await createSoftwareCredential(body, {
    id: user.id,
    role: user.role,
  });

  return ok({ data: credential }, 201);
});
