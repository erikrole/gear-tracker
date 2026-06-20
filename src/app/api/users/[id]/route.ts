import { withAuth } from "@/lib/api";
import { BookingKind, BookingStatus, BulkMovementKind, Prisma, ScanSessionStatus, ShiftArea, ShiftWorkerType, StudentYear } from "@prisma/client";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { requireRole } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";
import { upsertBulkBalancesAndMovements } from "@/lib/services/bookings-helpers";
import { normalizeSlackHandle, normalizeSlackProfileUrl, normalizeWiscardNumber, slackHandleSchema, slackProfileUrlSchema, wiscardNumberSchema } from "@/lib/validation";
import { z } from "zod";

const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  email: z.string().email().optional(),
  locationId: z.string().cuid().nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  wiscardNumber: wiscardNumberSchema,
  slackHandle: slackHandleSchema,
  slackProfileUrl: slackProfileUrlSchema,
  primaryArea: z.nativeEnum(ShiftArea).nullable().optional(),
  staffingType: z.nativeEnum(ShiftWorkerType).optional(),
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

const MAX_DIRECT_REPORT_CHAIN_DEPTH = 50;

async function assertDirectReportAssignment(targetUserId: string, directReportId: string) {
  if (directReportId === targetUserId) {
    throw new HttpError(400, "A user cannot report to themselves");
  }

  const seen = new Set<string>([targetUserId]);
  let cursor: string | null = directReportId;

  for (let depth = 0; cursor && depth < MAX_DIRECT_REPORT_CHAIN_DEPTH; depth += 1) {
    if (seen.has(cursor)) {
      throw new HttpError(400, "Direct report assignment would create a reporting cycle");
    }
    seen.add(cursor);

    const manager: { id: string; directReportId: string | null } | null = await db.user.findUnique({
      where: { id: cursor },
      select: { id: true, directReportId: true },
    });

    if (!manager) {
      throw new HttpError(400, "Direct report user not found");
    }

    cursor = manager.directReportId;
  }

  if (cursor) {
    throw new HttpError(400, "Direct report chain is too deep");
  }
}

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
      staffingType: target.staffingType,
      locationId: target.locationId,
      location: target.location?.name ?? null,
      phone: target.phone,
      wiscardNumber: target.wiscardNumber ?? null,
      slackHandle: target.slackHandle ?? null,
      slackProfileUrl: target.slackProfileUrl ?? null,
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
  if (Object.prototype.hasOwnProperty.call(body, "wiscardNumber")) {
    updateData.wiscardNumber = normalizeWiscardNumber(body.wiscardNumber);
  }

  if (Object.prototype.hasOwnProperty.call(body, "slackHandle")) {
    updateData.slackHandle = normalizeSlackHandle(body.slackHandle);
  }
  if (Object.prototype.hasOwnProperty.call(body, "slackProfileUrl")) {
    updateData.slackProfileUrl = normalizeSlackProfileUrl(body.slackProfileUrl);
  }

  if (body.primaryArea !== undefined) {
    updateData.primaryArea = body.primaryArea;
  }

  if (body.staffingType !== undefined) {
    updateData.staffingType = body.staffingType;
  }

  if (body.active !== undefined) {
    // Deactivation requires atomic check + cancel + session cleanup
    if (body.active === false && target.active === true) {
      const deactivationResult = await db.$transaction(async (tx) => {
        // Re-check OPEN checkouts inside transaction to prevent TOCTOU
        const openCheckouts = await tx.booking.count({
          where: {
            requesterUserId: id,
            kind: "CHECKOUT",
            status: BookingStatus.OPEN,
          },
        });
        if (openCheckouts > 0) {
          throw new HttpError(
            400,
            `Cannot deactivate: user has ${openCheckouts} open checkout${openCheckouts > 1 ? "s" : ""}. Return all gear first.`
          );
        }

        // Auto-cancel non-open work and clean up allocations/scan sessions like booking cancellation does.
        const toCancel = await tx.booking.findMany({
          where: {
            requesterUserId: id,
            status: { in: [BookingStatus.BOOKED, BookingStatus.DRAFT, BookingStatus.PENDING_PICKUP] },
          },
          select: {
            id: true,
            kind: true,
            status: true,
            locationId: true,
            bulkItems: { select: { bulkSkuId: true, plannedQuantity: true } },
          },
        });

        if (toCancel.length > 0) {
          for (const booking of toCancel) {
            if (booking.kind === BookingKind.CHECKOUT && booking.status === BookingStatus.PENDING_PICKUP && booking.bulkItems.length > 0) {
              await upsertBulkBalancesAndMovements(tx, {
                locationId: booking.locationId,
                bookingId: booking.id,
                actorUserId: user.id,
                kind: BulkMovementKind.CHECKIN,
                items: booking.bulkItems.map((item) => ({
                  bulkSkuId: item.bulkSkuId,
                  quantity: item.plannedQuantity,
                })),
              });
            }
          }

          await tx.booking.updateMany({
            where: { id: { in: toCancel.map((b) => b.id) } },
            data: { status: BookingStatus.CANCELLED },
          });
          await tx.assetAllocation.updateMany({
            where: { bookingId: { in: toCancel.map((b) => b.id) } },
            data: { active: false },
          });
          await tx.scanSession.updateMany({
            where: { bookingId: { in: toCancel.map((b) => b.id) }, status: ScanSessionStatus.OPEN },
            data: { status: ScanSessionStatus.CANCELLED },
          });
        }

        // Invalidate all existing sessions so deactivated user is immediately locked out
        await tx.session.deleteMany({ where: { userId: id } });
        const directReportCleanup = await tx.user.updateMany({
          where: { directReportId: id },
          data: { directReportId: null },
        });

        return {
          cancelledIds: toCancel.map((b) => b.id),
          directReportsCleared: directReportCleanup.count,
        };
      }, { isolationLevel: "Serializable" });

      if (deactivationResult.cancelledIds.length > 0 || deactivationResult.directReportsCleared > 0) {
        await createAuditEntry({
          actorId: user.id,
          actorRole: user.role,
          entityType: "user",
          entityId: id,
          action: "deactivation_cancelled_bookings",
          after: {
            cancelledBookingIds: deactivationResult.cancelledIds,
            cancelledCount: deactivationResult.cancelledIds.length,
            directReportsCleared: deactivationResult.directReportsCleared,
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
    if (body.directReportId) {
      await assertDirectReportAssignment(id, body.directReportId);
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
      if (target.some((t) => t.includes("wiscard_number") || t.includes("wiscardNumber"))) {
        throw new HttpError(409, "That Wiscard value is already linked to another account");
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
      staffingType: updated.staffingType,
      locationId: updated.locationId,
      location: updated.location?.name ?? null,
      phone: updated.phone,
      wiscardNumber: updated.wiscardNumber ?? null,
      slackHandle: updated.slackHandle ?? null,
      slackProfileUrl: updated.slackProfileUrl ?? null,
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
