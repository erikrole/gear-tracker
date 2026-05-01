import { withAuth } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { HttpError, ok, parsePagination } from "@/lib/http";
import { requireRole } from "@/lib/rbac";
import { roleSchema } from "@/lib/validation";
import { createAuditEntry } from "@/lib/audit";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const createUserSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  role: roleSchema.default("STAFF"),
  locationId: z.string().cuid().nullable().optional()
});

export const GET = withAuth(async (req, { user }) => {
  requireRole(user.role, ["ADMIN", "STAFF", "STUDENT"]);

  const { searchParams } = new URL(req.url);
  const { limit, offset } = parsePagination(searchParams);

  const q = searchParams.get("q")?.trim();
  const roleParam = searchParams.get("role");
  const locationId = searchParams.get("locationId");
  const activeParam = searchParams.get("active");
  const sort = searchParams.get("sort") || "name";

  // Build where clause
  const conditions: Prisma.UserWhereInput[] = [];

  // Default to active-only unless explicitly requesting all or inactive
  if (activeParam === "false") {
    conditions.push({ active: false });
  } else if (activeParam !== "all") {
    conditions.push({ active: true });
  }

  if (q) {
    conditions.push({
      OR: [
        { name: { contains: q, mode: "insensitive" as const } },
        { email: { contains: q, mode: "insensitive" as const } },
      ],
    });
  }

  if (roleParam && ["ADMIN", "STAFF", "STUDENT"].includes(roleParam)) {
    conditions.push({ role: roleParam as Prisma.EnumRoleFilter });
  }

  if (locationId) {
    conditions.push({ locationId });
  }

  const where: Prisma.UserWhereInput =
    conditions.length > 0 ? { AND: conditions } : {};

  // Build orderBy
  const orderBy: Prisma.UserOrderByWithRelationInput = (() => {
    switch (sort) {
      case "name_desc":
        return { name: "desc" as const };
      case "role":
        return { role: "asc" as const };
      case "role_desc":
        return { role: "desc" as const };
      case "email":
        return { email: "asc" as const };
      case "email_desc":
        return { email: "desc" as const };
      case "created":
        return { createdAt: "asc" as const };
      case "created_desc":
        return { createdAt: "desc" as const };
      default:
        return { name: "asc" as const };
    }
  })();

  const [data, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy,
      take: limit,
      skip: offset,
      include: {
        location: { select: { id: true, name: true } },
      },
    }),
    db.user.count({ where }),
  ]);

  return ok({
    data: data.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      phone: u.phone,
      primaryArea: u.primaryArea,
      locationId: u.locationId,
      location: u.location?.name ?? null,
      avatarUrl: u.avatarUrl ?? null,
      active: u.active,
      title: u.title ?? null,
      gradYear: u.gradYear ?? null,
      studentYearOverride: u.studentYearOverride ?? null,
    })),
    total,
    limit,
    offset,
  });
});

export const POST = withAuth(async (req, { user }) => {
  requireRole(user.role, ["ADMIN", "STAFF"]);

  const body = createUserSchema.parse(await req.json());

  // Only ADMIN can create users with the ADMIN role
  if (user.role !== "ADMIN" && body.role === "ADMIN") {
    throw new HttpError(403, "Only admins can create admin users");
  }

  const email = body.email.toLowerCase();

  const passwordHash = await hashPassword(body.password);

  let created;
  try {
    created = await db.user.create({
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
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new HttpError(409, "A user with this email already exists");
    }
    throw err;
  }

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
