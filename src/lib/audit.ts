import { Prisma, Role } from "@prisma/client";
import { db } from "@/lib/db";

type AuditEntry = {
  actorId: string;
  actorRole: Role;
  entityType: string;
  entityId: string;
  action: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
};

/**
 * Create an audit log entry with actor role always included.
 * Per AREA_USERS.md § Authorization Guardrails #4:
 * "Audit logs must include actor role and actor id for all edits."
 */
export async function createAuditEntry(entry: AuditEntry) {
  await db.auditLog.create({
    data: {
      actorUserId: entry.actorId,
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      beforeJson: entry.before
        ? (entry.before as Prisma.InputJsonValue)
        : undefined,
      afterJson: {
        ...(entry.after ?? {}),
        _actorRole: entry.actorRole,
      } as Prisma.InputJsonValue,
    },
  });
}
