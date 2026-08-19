import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";
import {
  archiveSoftwareCredential,
  updateSoftwareCredential,
} from "@/lib/services/software";
import { updateSoftwareCredentialSchema } from "@/lib/software-vault-validation";

export const PATCH = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "software", "manage");
  const body = updateSoftwareCredentialSchema.parse(await req.json());
  const credential = await updateSoftwareCredential(params.id, body);

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "software_credential",
    entityId: params.id,
    action: body.archived === true ? "archive" : body.archived === false ? "restore" : "update",
    after: {
      name: credential.name,
      accountEmailChanged: body.accountEmail !== undefined,
      passwordChanged: body.password !== undefined,
      archived: credential.archivedAt !== null,
    },
  });

  return ok({ data: credential });
});

export const DELETE = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "software", "manage");
  const credential = await archiveSoftwareCredential(params.id);

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "software_credential",
    entityId: params.id,
    action: "archive",
    after: { name: credential.name, archived: true },
  });

  return ok({ data: credential });
});
