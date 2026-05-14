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
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  role: roleSchema.default("STAFF"),
  locationId: z.string().cuid().nullable().optional()
});

type CreatedUser = Prisma.UserGetPayload<{
  include: { location: { select: { name: true } } };
}>;

type AllowedEmailAudit = {
  id: string;
  action: "created" | "claimed";
  after: Record<string, unknown>;
};

export const GET = withAuth(async (req, { user }) => {
  requireRole(user.role, ["ADMIN", "STAFF", "STUDENT"]);

  const { searchParams } = new URL(req.url);
  const { limit, offset } = parsePagination(searchParams);

  const q = searchParams.get("q")?.trim();
  const roleParam = searchParams.get("role");
  const locationId = searchParams.get("locationId");
  const activeParam = searchParams.get("active");
  const sort = searchParams.get("sort") || "name";
  const yearParam = searchParams.get("year");      // FRESHMAN | SOPHOMORE | JUNIOR | SENIOR | GRAD
  const sportParam = searchParams.get("sport");    // sport code (e.g. WHKY)
  const areaParam = searchParams.get("area");      // ShiftArea enum value

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

  if (sportParam) {
    conditions.push({ sportAssignments: { some: { sportCode: sportParam } } });
  }

  if (areaParam) {
    conditions.push({
      OR: [
        { primaryArea: areaParam as Prisma.EnumShiftAreaFilter },
        { areaAssignments: { some: { area: areaParam as Prisma.EnumShiftAreaFilter } } },
      ],
    });
  }

  // Year filter — derives an expected gradYear from a Sept→Aug academic calendar
  // and matches either an explicit override or that derived gradYear.
  if (yearParam && ["FRESHMAN", "SOPHOMORE", "JUNIOR", "SENIOR", "GRAD"].includes(yearParam)) {
    const now = new Date();
    const acadYearEnd = now.getMonth() >= 7 ? now.getFullYear() + 1 : now.getFullYear();
    const yearGradMap: Record<string, Prisma.UserWhereInput> = {
      SENIOR:    { gradYear: acadYearEnd },
      JUNIOR:    { gradYear: acadYearEnd + 1 },
      SOPHOMORE: { gradYear: acadYearEnd + 2 },
      FRESHMAN:  { gradYear: { gte: acadYearEnd + 3 } },
      GRAD:      { gradYear: { lte: acadYearEnd - 1 } },
    };
    const derivedMatch = yearGradMap[yearParam]!; // yearParam validated by includes() above
    conditions.push({
      OR: [
        { studentYearOverride: yearParam as "FRESHMAN" | "SOPHOMORE" | "JUNIOR" | "SENIOR" | "GRAD" },
        { AND: [{ studentYearOverride: null }, derivedMatch] },
      ],
    });
  }

  const where: Prisma.UserWhereInput =
    conditions.length > 0 ? { AND: conditions } : {};

  // Build orderBy
  const orderBy: Prisma.UserOrderByWithRelationInput[] = (() => {
    switch (sort) {
      case "name_desc":
        return [{ name: "desc" as const }];
      case "role":
        return [{ role: "asc" as const }, { name: "asc" as const }];
      case "role_desc":
        return [{ role: "desc" as const }, { name: "asc" as const }];
      case "email":
        return [{ email: "asc" as const }];
      case "email_desc":
        return [{ email: "desc" as const }];
      case "created":
        return [{ createdAt: "asc" as const }, { name: "asc" as const }];
      case "created_desc":
        return [{ createdAt: "desc" as const }, { name: "asc" as const }];
      case "lastActive":
        return [
          { lastActiveAt: { sort: "asc" as const, nulls: "last" as const } },
          { name: "asc" as const },
        ];
      case "lastActive_desc":
        return [
          { lastActiveAt: { sort: "desc" as const, nulls: "last" as const } },
          { name: "asc" as const },
        ];
      default:
        return [{ name: "asc" as const }];
    }
  })();

  const [data, total, active, inactive, missingPhotos, roleGroups] = await Promise.all([
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
    db.user.count({ where: { AND: [where, { active: true }] } }),
    db.user.count({ where: { AND: [where, { active: false }] } }),
    db.user.count({ where: { AND: [where, { avatarUrl: null }] } }),
    db.user.groupBy({
      by: ["role"],
      where,
      _count: { _all: true },
    }),
  ]);

  const byRole = {
    ADMIN: 0,
    STAFF: 0,
    STUDENT: 0,
  };
  for (const group of roleGroups) {
    byRole[group.role] = group._count._all;
  }

  return ok({
    data: data.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      phone: u.phone,
      slackHandle: u.slackHandle ?? null,
      slackProfileUrl: u.slackProfileUrl ?? null,
      primaryArea: u.primaryArea,
      locationId: u.locationId,
      location: u.location?.name ?? null,
      avatarUrl: u.avatarUrl ?? null,
      active: u.active,
      title: u.title ?? null,
      gradYear: u.gradYear ?? null,
      studentYearOverride: u.studentYearOverride ?? null,
      lastActiveAt: u.lastActiveAt?.toISOString() ?? null,
    })),
    total,
    limit,
    offset,
    stats: {
      total,
      active,
      inactive,
      missingPhotos,
      byRole,
    },
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

  let result: { created: CreatedUser; allowedEmailAudit: AllowedEmailAudit | null } | null = null;
  try {
    result = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: body.name,
          email,
          passwordHash,
          forcePasswordChange: true,
          role: body.role,
          locationId: body.locationId ?? null
        },
        include: {
          location: { select: { name: true } }
        }
      });

      let allowedEmailAudit: AllowedEmailAudit | null = null;
      if (body.role !== "ADMIN") {
        const now = new Date();
        const existingAllowed = await tx.allowedEmail.findUnique({
          where: { email },
          select: { id: true, email: true, role: true, claimedAt: true, claimedById: true },
        });

        if (existingAllowed) {
          if (!existingAllowed.claimedAt || !existingAllowed.claimedById) {
            const claimed = await tx.allowedEmail.update({
              where: { id: existingAllowed.id },
              data: { role: body.role, claimedAt: now, claimedById: created.id },
              select: { id: true, email: true, role: true, claimedAt: true, claimedById: true },
            });
            allowedEmailAudit = {
              id: claimed.id,
              action: "claimed",
              after: {
                email: claimed.email,
                role: claimed.role,
                claimedById: claimed.claimedById,
                claimedAt: claimed.claimedAt?.toISOString() ?? null,
                source: "direct_user_create",
              },
            };
          }
        } else {
          const entry = await tx.allowedEmail.create({
            data: {
              email,
              role: body.role,
              createdById: user.id,
              claimedAt: now,
              claimedById: created.id,
            },
            select: { id: true, email: true, role: true, claimedAt: true, claimedById: true },
          });
          allowedEmailAudit = {
            id: entry.id,
            action: "created",
            after: {
              email: entry.email,
              role: entry.role,
              claimedById: entry.claimedById,
              claimedAt: entry.claimedAt?.toISOString() ?? null,
              source: "direct_user_create",
            },
          };
        }
      }

      return { created, allowedEmailAudit };
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new HttpError(409, "A user with this email already exists");
    }
    throw err;
  }

  if (!result) {
    throw new HttpError(500, "Failed to create user");
  }

  const { created, allowedEmailAudit } = result;

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "user",
    entityId: created.id,
    action: "created",
    after: {
      name: created.name,
      email: created.email,
      role: created.role,
      locationId: created.locationId,
      forcePasswordChange: true,
    },
  });

  if (allowedEmailAudit) {
    await createAuditEntry({
      actorId: user.id,
      actorRole: user.role,
      entityType: "allowed_email",
      entityId: allowedEmailAudit.id,
      action: allowedEmailAudit.action,
      after: allowedEmailAudit.after,
    });
  }

  return ok(
    {
      data: {
        id: created.id,
        name: created.name,
        email: created.email,
        role: created.role,
        locationId: created.locationId,
        location: created.location?.name ?? null,
        forcePasswordChange: true
      }
    },
    201
  );
});
