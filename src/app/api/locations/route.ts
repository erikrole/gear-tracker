import { z } from "zod";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";
import { enforceRateLimit, SETTINGS_MUTATION_LIMIT } from "@/lib/rate-limit";

/**
 * GET /api/locations
 * Lists active locations by default. Pass `?includeInactive=1` (admin only)
 * to also return deactivated entries — used by the settings catalog UI.
 */
export const GET = withAuth(async (req, { user }) => {
  const includeInactive = new URL(req.url).searchParams.get("includeInactive") === "1";
  const where = includeInactive && user.role === "ADMIN" ? {} : { active: true };

  const locations = await db.location.findMany({
    where,
    orderBy: { name: "asc" },
    include: includeInactive
      ? {
          _count: {
            select: {
              users: true,
              assets: true,
              bookings: true,
              kioskDevices: true,
              locationMappings: true,
            },
          },
        }
      : undefined,
  });
  return ok({ data: locations });
});

const createLocationSchema = z.object({
  name: z.string().trim().min(1).max(200),
  address: z.string().trim().max(500).optional(),
  isHomeVenue: z.boolean().optional(),
});

/** Create a new location (ADMIN only per D-027). */
export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "location", "manage");
  await enforceRateLimit(`locations:write:${user.id}`, SETTINGS_MUTATION_LIMIT);

  const body = createLocationSchema.parse(await req.json());

  const existing = await db.location.findUnique({ where: { name: body.name } });
  if (existing) {
    throw new HttpError(409, "A location with that name already exists.");
  }

  const created = await db.location.create({
    data: {
      name: body.name,
      address: body.address && body.address.length > 0 ? body.address : null,
      isHomeVenue: body.isHomeVenue ?? false,
    },
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "location",
    entityId: created.id,
    action: "created",
    after: { name: created.name, address: created.address, isHomeVenue: created.isHomeVenue },
  });

  return ok({ data: created }, 201);
});
