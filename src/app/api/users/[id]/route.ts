import { withAuth } from "@/lib/api";
import { Prisma, ShiftArea, StudentYear } from "@prisma/client";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { requireRole } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";
import { z } from "zod";

const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  email: z.string().email().optional(),
  locationId: z.string().cuid().nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  primaryArea: z.nativeEnum(ShiftArea).nullable().optional(),
  active: z.boolean().optional(),
  // Profile fields migrated from the Sheet.
  title: z.string().max(120).nullable().optional(),
  athleticsEmail: z.string().email().max(255).nullable().optional(),
  startDate: z.string().datetime().nullable().optional(),
  gradYear: z.number().int().min(1900).max(2100).nullable().optional(),
  studentYearOverride: z.nativeEnum(StudentYear).nullable().optional(),
  topSize: z.string().max(40).nullable().optional(),
  bottomSize: z.string().max(40).nullable().optional(),
  shoeSize: z.string().max(40).nullable().optional(),
  // Staff/admin only — direct report (FK + free-text fallback).
  directReportId: z.string().cuid().nullable().optional(),
  directReportName: z.string().trim().max(120).nullable().optional(),
});

export const GET = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requireRole(user.role, ["ADMIN", "STAFF", "STUDENT"]);
  const { id } = params;

  // Students can only view themselves
  if (user.role === "STUDENT" && user.id !== id) {
    throw new HttpError(403, "Forbidden");
  }

  const target = await db.user.findUnique({
    where: { id },
    include: {
      location: { select: { name: true } },
      sportAssignments: true,
      areaAssignments: true,
      directReport: { select: { id: true, name: true } },
    },
  });
  if (!target) throw new HttpError(404, "User not found");

  const isSelfOrAdmin = user.id === id || user.role === "ADMIN";

  return ok({
    data: {
      id: target.id,
      name: target.name,
      email: target.email,
      role: target.role,
      locationId: target.locationId,
      location: target.location?.name ?? null,
      phone: target.phone,
      primaryArea: target.primaryArea,
      avatarUrl: target.avatarUrl ?? null,
      active: target.active,
      createdAt: target.createdAt?.toISOString() ?? null,
      sportAssignments: target.sportAssignments,
      areaAssignments: target.areaAssignments,
      icsToken: isSelfOrAdmin ? (target.icsToken ?? null) : undefined,
      title: target.title ?? null,
      athleticsEmail: target.athleticsEmail ?? null,
      startDate: target.startDate?.toISOString() ?? null,
      directReportId: target.directReportId ?? null,
      directReportName: target.directReportName ?? null,
      directReport: target.directReport
        ? { id: target.directReport.id, name: target.directReport.name }
        : null,
      gradYear: target.gradYear ?? null,
      studentYearOverride: target.studentYearOverride ?? null,
      topSize: target.topSize ?? null,
      bottomSize: target.bottomSize ?? null,
      shoeSize: target.shoeSize ?? null,
    },
  });
});

export const PATCH = withAuth<{ id: string }>(async (req, { user, params }) => {
  requireRole(user.role, ["ADMIN", "STAFF"]);

  const { id } = params;
  const body = updateUserSchema.parse(await req.json());

  const target = await db.user.findUnique({ where: { id } });
  if (!target) {
    throw new HttpError(404, "User not found");
  }

  // STAFF can only edit STUDENT users — not other STAFF or ADMIN
  if (user.role === "STAFF" && target.role !== "STUDENT") {
    throw new HttpError(403, "Staff can only edit student profiles");
  }

  const updateData: Record<string, unknown> = {};

  if (body.name !== undefined) {
    updateData.name = body.name;
  }

  if (body.email !== undefined) {
    const email = body.email.toLowerCase();
    if (email !== target.email) {
      updateData.email = email;
    }
  }

  if (body.locationId !== undefined) {
    updateData.locationId = body.locationId;
  }

  if (body.phone !== undefined) {
    updateData.phone = body.phone;
  }

  if (body.primaryArea !== undefined) {
    updateData.primaryArea = body.primaryArea;
  }

  if (body.active !== undefined) {
    // Deactivation requires atomic check + cancel + session cleanup
    if (body.active === false && target.active === true) {
      const cancelledIds = await db.$transaction(async (tx) => {
        // Re-check OPEN checkouts inside transaction to prevent TOCTOU
        const openCheckouts = await tx.booking.count({
          where: {
            requesterUserId: id,
            kind: "CHECKOUT",
            status: "OPEN",
          },
        });
        if (openCheckouts > 0) {
          throw new HttpError(
            400,
            `Cannot deactivate: user has ${openCheckouts} open checkout${openCheckouts > 1 ? "s" : ""}. Return all gear first.`
          );
        }

        // Auto-cancel BOOKED reservations and DRAFT bookings
        const toCancel = await tx.booking.findMany({
          where: {
            requesterUserId: id,
            OR: [
              { status: "BOOKED" },
              { status: "DRAFT" },
            ],
          },
          select: { id: true },
        });

        if (toCancel.length > 0) {
          await tx.booking.updateMany({
            where: { id: { in: toCancel.map((b) => b.id) } },
            data: { status: "CANCELLED" },
          });
        }

        // Invalidate all existing sessions so deactivated user is immediately locked out
        await tx.session.deleteMany({ where: { userId: id } });

        return toCancel.map((b) => b.id);
      }, { isolationLevel: "Serializable" });

      if (cancelledIds.length > 0) {
        await createAuditEntry({
          actorId: user.id,
          actorRole: user.role,
          entityType: "user",
          entityId: id,
          action: "deactivation_cancelled_bookings",
          after: {
            cancelledBookingIds: cancelledIds,
            cancelledCount: cancelledIds.length,
          },
        });
      }
    }

    updateData.active = body.active;
  }

  if (Object.prototype.hasOwnProperty.call(body, "title")) {
    updateData.title = body.title ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(body, "athleticsEmail")) {
    updateData.athleticsEmail = body.athleticsEmail ? body.athleticsEmail.toLowerCase() : null;
  }
  if (Object.prototype.hasOwnProperty.call(body, "startDate")) {
    updateData.startDate = body.startDate ? new Date(body.startDate) : null;
  }
  if (Object.prototype.hasOwnProperty.call(body, "gradYear")) {
    updateData.gradYear = body.gradYear ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(body, "studentYearOverride")) {
    updateData.studentYearOverride = body.studentYearOverride ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(body, "topSize")) {
    updateData.topSize = body.topSize ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(body, "bottomSize")) {
    updateData.bottomSize = body.bottomSize ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(body, "shoeSize")) {
    updateData.shoeSize = body.shoeSize ?? null;
  }

  // Direct report — staff/admin only. UI sends *either* a cuid (existing user)
  // *or* a free-text name. Setting one nulls the other so display logic stays unambiguous.
  if (Object.prototype.hasOwnProperty.call(body, "directReportId")) {
    if (body.directReportId === id) {
      throw new HttpError(400, "A user cannot report to themselves");
    }
    updateData.directReportId = body.directReportId ?? null;
    if (body.directReportId) {
      updateData.directReportName = null;
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, "directReportName")) {
    const name = body.directReportName?.trim() || null;
    updateData.directReportName = name;
    if (name) {
      updateData.directReportId = null;
    }
  }

  if (Object.keys(updateData).length === 0) {
    throw new HttpError(400, "No fields to update");
  }

  const beforeDiff: Record<string, unknown> = {};
  const afterDiff: Record<string, unknown> = {};
  for (const key of Object.keys(updateData)) {
    beforeDiff[key] = (target as Record<string, unknown>)[key] ?? null;
  }

  let updated;
  try {
    updated = await db.user.update({
      where: { id },
      data: updateData,
      include: {
        location: { select: { name: true } },
        sportAssignments: true,
        areaAssignments: true,
        directReport: { select: { id: true, name: true } },
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const target = (err.meta?.target as string[] | undefined) ?? [];
      if (target.some((t) => t.includes("athletics_email"))) {
        throw new HttpError(409, "That athletics email is already in use");
      }
      throw new HttpError(409, "A user with this email already exists");
    }
    throw err;
  }

  for (const key of Object.keys(updateData)) {
    afterDiff[key] = (updated as Record<string, unknown>)[key] ?? null;
  }

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "user",
    entityId: id,
    action: "updated",
    before: beforeDiff,
    after: afterDiff,
  });

  return ok({
    data: {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      locationId: updated.locationId,
      location: updated.location?.name ?? null,
      phone: updated.phone,
      primaryArea: updated.primaryArea,
      avatarUrl: updated.avatarUrl ?? null,
      active: updated.active,
      createdAt: updated.createdAt?.toISOString() ?? null,
      sportAssignments: updated.sportAssignments,
      areaAssignments: updated.areaAssignments,
      title: updated.title ?? null,
      athleticsEmail: updated.athleticsEmail ?? null,
      startDate: updated.startDate?.toISOString() ?? null,
      directReportId: updated.directReportId ?? null,
      directReportName: updated.directReportName ?? null,
      directReport: updated.directReport
        ? { id: updated.directReport.id, name: updated.directReport.name }
        : null,
      gradYear: updated.gradYear ?? null,
      studentYearOverride: updated.studentYearOverride ?? null,
      topSize: updated.topSize ?? null,
      bottomSize: updated.bottomSize ?? null,
      shoeSize: updated.shoeSize ?? null,
    },
  });
});
