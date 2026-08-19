import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission, requirePermissionOrCollaboratorCapability } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";
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
  const body = createSoftwareCredentialSchema.parse(await req.json());
  const credential = await createSoftwareCredential(body);

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "software_credential",
    entityId: credential.id,
    action: "create",
    after: {
      name: credential.name,
      visibleTo: credential.visibleTo,
      secretsStored: true,
    },
  });

  return ok({ data: credential }, 201);
});
