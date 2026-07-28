import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok, HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { resolveBlastTargets, type BlastTargetSpec } from "@/lib/services/blast-targeting";

export const GET = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "blast", "view");

  const blast = await db.blast.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      body: true,
      severity: true,
      status: true,
      targetKind: true,
      targetSpec: true,
      targetSummary: true,
      eventId: true,
      requiresAck: true,
      expiresAt: true,
      recipientCount: true,
      sentAt: true,
      cancelledAt: true,
      createdAt: true,
      createdBy: { select: { id: true, name: true } },
      cancelledBy: { select: { id: true, name: true } },
      event: { select: { id: true, summary: true, startsAt: true } },
      recipients: {
        // Un-acknowledged first: the operational question is who still needs chasing.
        orderBy: [{ acknowledgedAt: "asc" }, { user: { name: "asc" } }],
        select: {
          userId: true,
          pushStatus: true,
          pushAttemptedAt: true,
          deliveredAt: true,
          readAt: true,
          acknowledgedAt: true,
          user: {
            select: { id: true, name: true, role: true, primaryArea: true, staffingType: true, avatarUrl: true },
          },
        },
      },
    },
  });
  if (!blast) throw new HttpError(404, "Blast not found");

  // Crew and group membership move after a blast is sent, but the recipient set is
  // frozen. Surfacing the drift lets the sender follow up deliberately instead of
  // assuming everyone currently on the event was reached.
  let addedSinceSend: Array<{ id: string; name: string }> = [];
  if (blast.status !== "CANCELLED") {
    try {
      const current = await resolveBlastTargets(blast.targetSpec as unknown as BlastTargetSpec);
      const reached = new Set(blast.recipients.map((r) => r.userId));
      addedSinceSend = current.users.filter((u) => !reached.has(u.id)).map((u) => ({ id: u.id, name: u.name }));
    } catch {
      // The event may have been unpublished or deleted since. Drift is a nicety;
      // never let it take down the tracking page.
      addedSinceSend = [];
    }
  }

  // targetSpec stays server-side; targetSummary is the human-facing version.
  const { targetSpec, ...rest } = blast;
  void targetSpec;
  return ok({ data: { ...rest, addedSinceSend } });
});
