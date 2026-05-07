import { z } from "zod";
import { Prisma } from "@prisma/client";
import { withAuth } from "@/lib/api";
import { createAuditEntry } from "@/lib/audit";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { enforceRateLimit, SETTINGS_MUTATION_LIMIT } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/rbac";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  active: z.boolean().optional(),
}).refine((body) => body.name !== undefined || body.active !== undefined, {
  message: "No fields to update",
});

export const PATCH = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "asset", "edit");
  await enforceRateLimit(`departments:write:${user.id}`, SETTINGS_MUTATION_LIMIT);

  const body = patchSchema.parse(await req.json());

  const existing = await db.department.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, active: true },
  });
  if (!existing) throw new HttpError(404, "Department not found");

  const data: { name?: string; active?: boolean } = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.active !== undefined) data.active = body.active;

  try {
    const department = await db.department.update({
      where: { id: params.id },
      data,
      select: {
        id: true,
        name: true,
        active: true,
        _count: {
          select: {
            assets: true,
            bulkSkus: true,
          },
        },
      },
    });

    await createAuditEntry({
      actorId: user.id,
      actorRole: user.role,
      entityType: "department",
      entityId: department.id,
      action: "updated",
      before: existing,
      after: { name: department.name, active: department.active },
    });

    return ok({ data: department });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError
      && error.code === "P2002"
    ) {
      throw new HttpError(409, "Department already exists");
    }
    throw error;
  }
});
