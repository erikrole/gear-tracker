import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { BookingStatus } from "@prisma/client";
import { deriveAssetStatus } from "@/lib/services/status";
import { createAuditEntry } from "@/lib/audit";

const patchAssetSchema = z
  .object({
    assetTag: z.string().min(1).optional(),
    name: z.string().max(500).nullable().optional(),
    type: z.string().min(1).optional(),
    brand: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
    serialNumber: z.string().min(1).optional(),
    qrCodeValue: z.string().min(1).optional(),
    purchaseDate: z.string().optional(),
    purchasePrice: z.number().positive().optional(),
    locationId: z.string().cuid().optional(),
    categoryId: z.string().cuid().nullable().optional(),
    status: z.enum(["AVAILABLE", "MAINTENANCE", "RETIRED"]).optional(),
    notes: z.string().max(10000).optional(),
    linkUrl: z.string().url().nullable().optional(),
    availableForReservation: z.boolean().optional(),
    availableForCheckout: z.boolean().optional(),
    availableForCustody: z.boolean().optional(),
  })
  .strict();

function parseNotes(notes: string | null) {
  if (!notes) return null;
  try {
    return JSON.parse(notes) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const params = await ctx.params;

    const [asset, derivedStatus, bookingHistory, activeAllocs, upcomingReservations, accessories] = await Promise.all([
      db.asset.findUnique({
        where: { id: params.id },
        include: { location: true, category: true, parent: { select: { id: true, assetTag: true, name: true, brand: true, model: true } } }
      }),
      deriveAssetStatus(params.id).catch(() => null),
      db.bookingSerializedItem.findMany({
        where: { assetId: params.id },
        include: {
          booking: {
            include: {
              requester: { select: { id: true, name: true, email: true } },
              location: { select: { id: true, name: true } },
              event: { select: { id: true, summary: true, sportCode: true, opponent: true, isHome: true, startsAt: true, endsAt: true } }
            }
          }
        },
        orderBy: [{ createdAt: "desc" }],
        take: 100,
      }),
      db.assetAllocation.findMany({
        where: { assetId: params.id, active: true },
        include: {
          booking: {
            select: {
              id: true,
              kind: true,
              status: true,
              title: true,
              startsAt: true,
              endsAt: true,
              requester: { select: { name: true } },
            },
          },
        },
      }),
      db.bookingSerializedItem.findMany({
        where: {
          assetId: params.id,
          booking: {
            kind: "RESERVATION",
            status: { in: [BookingStatus.DRAFT, BookingStatus.BOOKED, BookingStatus.OPEN] },
            endsAt: { gt: new Date() },
          },
        },
        include: {
          booking: {
            select: {
              id: true,
              title: true,
              status: true,
              startsAt: true,
              endsAt: true,
              requester: { select: { name: true } },
            },
          },
        },
        orderBy: { booking: { startsAt: "asc" } },
        take: 10,
      }),
      db.asset.findMany({
        where: { parentAssetId: params.id },
        select: {
          id: true,
          assetTag: true,
          name: true,
          brand: true,
          model: true,
          serialNumber: true,
          status: true,
          type: true,
          imageUrl: true,
        },
        orderBy: { assetTag: "asc" },
      }),
    ]);

    if (!asset) {
      throw new HttpError(404, "Asset not found");
    }

    const computedStatus = derivedStatus ?? asset.status;

    // Build active booking info for status line
    let activeBooking: { id: string; kind: string; status: string; title: string; startsAt: string; endsAt: string; requesterName: string } | null = null;
    for (const alloc of activeAllocs) {
      activeBooking = {
        id: alloc.booking.id,
        kind: alloc.booking.kind,
        status: alloc.booking.status,
        title: alloc.booking.title,
        startsAt: alloc.booking.startsAt.toISOString(),
        endsAt: alloc.booking.endsAt.toISOString(),
        requesterName: alloc.booking.requester.name,
      };
      break;
    }

    // Check if item has any booking history (for delete gating)
    const hasBookingHistory = bookingHistory.length > 0;

    return ok({
      data: {
        ...asset,
        computedStatus,
        metadata: parseNotes(asset.notes),
        activeBooking,
        hasBookingHistory,
        parentAsset: asset.parent ?? null,
        accessories,
        upcomingReservations: (() => {
          const seen = new Set<string>();
          if (activeBooking) seen.add(activeBooking.id);
          return upcomingReservations
            .filter((r) => {
              if (seen.has(r.booking.id)) return false;
              seen.add(r.booking.id);
              return true;
            })
            .map((r) => ({
              bookingId: r.booking.id,
              title: r.booking.title,
              status: r.booking.status,
              startsAt: r.booking.startsAt,
              endsAt: r.booking.endsAt,
              requesterName: r.booking.requester.name,
            }));
        })(),
        history: bookingHistory.map((entry) => ({
          id: entry.id,
          createdAt: entry.createdAt,
          booking: {
            id: entry.booking.id,
            kind: entry.booking.kind,
            status: entry.booking.status,
            title: entry.booking.title,
            startsAt: entry.booking.startsAt,
            endsAt: entry.booking.endsAt,
            sportCode: entry.booking.sportCode,
            requester: entry.booking.requester,
            location: entry.booking.location,
            event: entry.booking.event ? {
              id: entry.booking.event.id,
              summary: entry.booking.event.summary,
              sportCode: entry.booking.event.sportCode,
              opponent: entry.booking.event.opponent,
              isHome: entry.booking.event.isHome,
              startsAt: entry.booking.event.startsAt,
              endsAt: entry.booking.event.endsAt,
            } : null,
          },
        })),
      },
    });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    requirePermission(user.role, "asset", "edit");

    const params = await ctx.params;
    const body = patchAssetSchema.parse(await req.json());

    // QR code uniqueness check if updating qrCodeValue
    if (body.qrCodeValue) {
      const existing = await db.asset.findUnique({ where: { qrCodeValue: body.qrCodeValue } });
      if (existing && existing.id !== params.id) {
        throw new HttpError(409, "QR code already in use by another asset");
      }
    }

    const before = await db.asset.findUnique({ where: { id: params.id } });
    if (!before) throw new HttpError(404, "Asset not found");

    const asset = await db.asset.update({
      where: { id: params.id },
      data: {
        ...body,
        ...(body.purchaseDate ? { purchaseDate: new Date(body.purchaseDate) } : {}),
      },
      include: { location: true, category: true },
    });

    // Build granular before/after diff for changed fields only
    const changedKeys = Object.keys(body);
    const beforeDiff: Record<string, unknown> = {};
    const afterDiff: Record<string, unknown> = {};
    for (const key of changedKeys) {
      const beforeVal = (before as Record<string, unknown>)[key];
      const afterVal = (asset as Record<string, unknown>)[key];
      beforeDiff[key] = beforeVal ?? null;
      afterDiff[key] = afterVal ?? null;
    }

    await createAuditEntry({
      actorId: user.id,
      actorRole: user.role,
      entityType: "asset",
      entityId: params.id,
      action: "updated",
      before: beforeDiff,
      after: afterDiff,
    });

    return ok({ data: asset });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    requirePermission(user.role, "asset", "delete");

    const { id } = await ctx.params;
    const asset = await db.asset.findUnique({ where: { id } });
    if (!asset) throw new HttpError(404, "Asset not found");

    // Policy check: block delete if any booking history or active allocations
    const [bookingCount, activeAllocCount] = await Promise.all([
      db.bookingSerializedItem.count({ where: { assetId: id } }),
      db.assetAllocation.count({ where: { assetId: id, active: true } }),
    ]);

    if (bookingCount > 0 || activeAllocCount > 0) {
      throw new HttpError(
        409,
        "Cannot delete: this item has booking history. Use Retire instead."
      );
    }

    await db.asset.delete({ where: { id } });

    await createAuditEntry({
      actorId: user.id,
      actorRole: user.role,
      entityType: "asset",
      entityId: id,
      action: "deleted",
      before: { assetTag: asset.assetTag, type: asset.type },
    });

    return ok({ success: true });
  } catch (error) {
    return fail(error);
  }
}
