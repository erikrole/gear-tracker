import { withAuth } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { requireRole } from "@/lib/rbac";
import { roleSchema } from "@/lib/validation";
import { createAuditEntry } from "@/lib/audit";
import { z } from "zod";

const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  role: roleSchema.default("STAFF"),
  locationId: z.string().cuid().nullable().optional()
});

export const GET = withAuth(async (_req, { user }) => {
  requireRole(user.role, ["ADMIN", "STAFF", "STUDENT"]);

  const users = await db.user.findMany({
    orderBy: { name: "asc" },
    include: {
      location: {
        select: { id: true, name: true }
      }
    }
  });

  return ok({
    data: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      locationId: u.locationId,
      location: u.location?.name ?? null
    }))
  });
});

export const POST = withAuth(async (req, { user }) => {
  requireRole(user.role, ["ADMIN", "STAFF"]);

  const body = createUserSchema.parse(await req.json());
  const email = body.email.toLowerCase();

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    throw new HttpError(409, "A user with this email already exists");
  }

  const passwordHash = await hashPassword(body.password);

  const created = await db.user.create({
    data: {
      name: body.name,
      email,
      passwordHash,
      role: body.role,
      locationId: body.locationId ?? null
    },
    include: {
      location: { select: { name: true } }
    }
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "user",
    entityId: created.id,
    action: "created",
    after: { name: created.name, email: created.email, role: created.role, locationId: created.locationId },
  });

  return ok(
    {
      data: {
        id: created.id,
        name: created.name,
        email: created.email,
        role: created.role,
        locationId: created.locationId,
        location: created.location?.name ?? null
      }
    },
    201
  );
});
