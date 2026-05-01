import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { HttpError } from "@/lib/http";
import { requireRole } from "@/lib/rbac";
import { checkRateLimit } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { Prisma, type StudentYear } from "@prisma/client";
import { sportLabel } from "@/lib/sports";

const EXPORT_LIMIT = { max: 5, windowMs: 60_000 };

function csvField(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (/[,"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// Derive student year from grad year using Sept→Aug academic calendar.
// Mirrors src/app/(app)/users/types.ts deriveStudentYear so list and export agree.
function deriveYear(
  gradYear: number | null,
  override: StudentYear | null,
  now: Date,
): StudentYear | null {
  if (override) return override;
  if (gradYear == null) return null;
  const acadYearEnd = now.getMonth() >= 7 ? now.getFullYear() + 1 : now.getFullYear();
  const remaining = gradYear - acadYearEnd;
  if (remaining <= -1) return "GRAD";
  if (remaining === 0) return "SENIOR";
  if (remaining === 1) return "JUNIOR";
  if (remaining === 2) return "SOPHOMORE";
  return "FRESHMAN";
}

export const GET = withAuth(async (req, { user }) => {
  // Full export is staff/admin only — student self-export not in v1.
  requireRole(user.role, ["ADMIN", "STAFF"]);
  const { allowed } = checkRateLimit(`user:export:${user.id}`, EXPORT_LIMIT);
  if (!allowed) throw new HttpError(429, "Too many requests. Please wait a moment.");

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const roleParam = searchParams.get("role");
  const locationId = searchParams.get("locationId");
  const activeParam = searchParams.get("active");
  const yearParam = searchParams.get("year");
  const sportParam = searchParams.get("sport");
  const areaParam = searchParams.get("area");

  const conditions: Prisma.UserWhereInput[] = [];

  if (activeParam === "false") conditions.push({ active: false });
  else if (activeParam !== "all") conditions.push({ active: true });

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
  if (locationId) conditions.push({ locationId });
  if (sportParam) conditions.push({ sportAssignments: { some: { sportCode: sportParam } } });
  if (areaParam) {
    conditions.push({
      OR: [
        { primaryArea: areaParam as Prisma.EnumShiftAreaFilter },
        { areaAssignments: { some: { area: areaParam as Prisma.EnumShiftAreaFilter } } },
      ],
    });
  }
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
    conditions.push({
      OR: [
        { studentYearOverride: yearParam as StudentYear },
        { AND: [{ studentYearOverride: null }, yearGradMap[yearParam]] },
      ],
    });
  }

  const where: Prisma.UserWhereInput = conditions.length > 0 ? { AND: conditions } : {};

  const users = await db.user.findMany({
    where,
    orderBy: [{ role: "asc" }, { name: "asc" }],
    include: {
      location: { select: { name: true } },
      sportAssignments: { select: { sportCode: true } },
      areaAssignments: { select: { area: true, isPrimary: true } },
      directReport: { select: { name: true } },
    },
  });

  const now = new Date();
  const header = [
    "name", "role", "campus_email", "athletics_email", "phone",
    "title", "year", "grad_year",
    "primary_area", "areas", "sports", "location",
    "start_date", "direct_report",
    "top_size", "bottom_size", "shoe_size",
    "active", "created_at",
  ].join(",");

  const rows = users.map((u) => {
    const year = u.role === "STUDENT" ? deriveYear(u.gradYear, u.studentYearOverride, now) : null;
    const areas = u.areaAssignments
      .map((a) => `${a.area}${a.isPrimary ? "*" : ""}`)
      .join(" ");
    const sports = u.sportAssignments.map((s) => sportLabel(s.sportCode)).join(" ");
    return [
      csvField(u.name),
      csvField(u.role),
      csvField(u.email),
      csvField(u.athleticsEmail),
      csvField(u.phone),
      csvField(u.title),
      csvField(year),
      csvField(u.gradYear),
      csvField(u.primaryArea),
      csvField(areas),
      csvField(sports),
      csvField(u.location?.name ?? null),
      csvField(u.startDate ? u.startDate.toISOString().slice(0, 10) : null),
      csvField(u.directReport?.name ?? u.directReportName),
      csvField(u.topSize),
      csvField(u.bottomSize),
      csvField(u.shoeSize),
      csvField(u.active ? "true" : "false"),
      csvField(u.createdAt.toISOString()),
    ].join(",");
  });

  const body = [header, ...rows].join("\n");
  const filename = `users-${now.toISOString().slice(0, 10)}.csv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
