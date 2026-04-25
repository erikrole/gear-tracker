import { z } from "zod";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";
import { enforceRateLimit, SETTINGS_MUTATION_LIMIT } from "@/lib/rate-limit";

const createMappingSchema = z.object({
  pattern: z.string().min(1),
  locationId: z.string().cuid(),
  priority: z.number().int().min(0).default(0)
});

export const GET = withAuth(async () => {
  const mappings = await db.locationMapping.findMany({
    include: { location: { select: { id: true, name: true } } },
    orderBy: { priority: "desc" }
  });
  return ok({ data: mappings });
});

export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "location_mapping", "create");
  await enforceRateLimit(`location-mappings:write:${user.id}`, SETTINGS_MUTATION_LIMIT);
  const body = createMappingSchema.parse(await req.json());

  const mapping = await db.locationMapping.create({
    data: body,
    include: { location: { select: { id: true, name: true } } }
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "location_mapping",
    entityId: mapping.id,
    action: "create",
    after: { pattern: body.pattern, locationId: body.locationId },
  });

  return ok({ data: mapping }, 201);
});
