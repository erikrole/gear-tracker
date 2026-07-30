import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok, parsePagination } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";
import { enforceRateLimit, SETTINGS_MUTATION_LIMIT } from "@/lib/rate-limit";
import { createBlastSchema } from "@/lib/validation";
import { createAndSendBlast } from "@/lib/services/blasts";
import type { BlastTargetSpec } from "@/lib/services/blast-targeting";

export const GET = withAuth(async (req, { user }) => {
  requirePermission(user.role, "blast", "view");

  const { searchParams } = new URL(req.url);
  const { limit, offset } = parsePagination(searchParams);

  const [rows, total] = await Promise.all([
    db.blast.findMany({
      orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
      take: limit,
      skip: offset,
      select: {
        id: true,
        title: true,
        body: true,
        severity: true,
        status: true,
        targetKind: true,
        targetSummary: true,
        eventId: true,
        requiresAck: true,
        expiresAt: true,
        recipientCount: true,
        sentAt: true,
        cancelledAt: true,
        createdAt: true,
        createdBy: { select: { id: true, name: true } },
        _count: { select: { recipients: { where: { acknowledgedAt: { not: null } } } } },
      },
    }),
    db.blast.count(),
  ]);

  return ok({
    data: rows.map(({ _count, ...blast }) => ({ ...blast, acknowledgedCount: _count.recipients })),
    total,
    limit,
    offset,
  });
});

export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "blast", "create");
  await enforceRateLimit(`blasts:create:${user.id}`, SETTINGS_MUTATION_LIMIT);

  const body = createBlastSchema.parse(await req.json());

  const result = await createAndSendBlast(
    {
      title: body.title,
      body: body.body,
      severity: body.severity,
      requiresAck: body.requiresAck,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      spec: body.target as BlastTargetSpec,
    },
    user,
  );

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "blast",
    entityId: result.id,
    action: "sent",
    after: {
      title: body.title,
      severity: body.severity,
      targetKind: body.target.kind,
      targetSummary: result.targetSummary,
      recipientCount: result.recipientCount,
    },
  });

  return ok({ data: result }, 201);
});
