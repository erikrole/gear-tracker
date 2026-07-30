import { z } from "zod";
import { withAuth } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { addUnknownOccupant, assignCodeToUser } from "@/lib/services/licenses";

const bodySchema = z.union([
  z.object({ userId: z.string().min(1, "User is required"), label: z.never().optional() }),
  z.object({
    label: z.string().min(1, "Name is required").max(120, "Name must be 120 characters or fewer"),
    userId: z.never().optional(),
  }),
]);
const OCCUPY_LIMIT = { max: 20, windowMs: 60_000 };

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "license", "manage");
  const { allowed } = await checkRateLimit(`license:occupy:${user.id}`, OCCUPY_LIMIT);
  if (!allowed) throw new HttpError(429, "Too many requests. Please wait a moment.");
  const body = bodySchema.parse(await req.json());
  const assignment = body.userId !== undefined
    ? await assignCodeToUser(params.id, body.userId)
    : { code: await addUnknownOccupant(params.id, body.label), assignee: null };

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "license_code",
    entityId: params.id,
    action: "occupy",
    after: {
      assignedUserId: assignment.assignee?.id ?? null,
      occupantLabel: "label" in body ? body.label : null,
      status: assignment.code.status,
    },
  });

  return ok({ data: assignment.code }, 201);
});
