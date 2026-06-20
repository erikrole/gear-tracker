import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok, parsePagination } from "@/lib/http";
import { requireRole } from "@/lib/rbac";
import { optionalSportCodeSchema } from "@/lib/validation";
import { Prisma } from "@prisma/client";

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
  const sportParam = optionalSportCodeSchema.parse(searchParams.get("sport") ?? undefined);    // sport code (e.g. WHKY)
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
      staffingType: u.staffingType,
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
  throw new HttpError(
    410,
    "Temporary-password onboarding has been retired. Add the email to the allowlist so the user can register and set their own password."
  );
});
