import { z } from "zod";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok, HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";
import { enforceRateLimit, SETTINGS_MUTATION_LIMIT } from "@/lib/rate-limit";

const updateLocationSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  address: z.string().max(500).optional(),
  active: z.boolean().optional(),
  isHomeVenue: z.boolean().optional(),
});

export const PATCH = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "location", "manage");
  await enforceRateLimit(`locations:write:${user.id}`, SETTINGS_MUTATION_LIMIT);
  const { id } = params;

  const body = updateLocationSchema.parse(await req.json());
  const existing = await db.location.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Location not found");

  const updated = await db.location.update({
    where: { id },
    data: body,
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "location",
    entityId: id,
    action: "updated",
    before: { name: existing.name, address: existing.address, active: existing.active, isHomeVenue: existing.isHomeVenue },
    after: body,
  });

  return ok({ data: updated });
});
