import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntryTx } from "@/lib/audit";
import {
  cleanSummary,
  extractSportInfo,
  isHomeLocationText,
} from "@/lib/services/calendar-sync";
import { normalizeOpponentName, normalizeVenueText } from "@/lib/schedule-event-identity";
import { nullableSportCodeSchema } from "@/lib/validation";
import { isHomeFromVenueTone, VENUE_TONE_VALUES } from "@/lib/venue-tone";
import { z } from "zod";
import { normalizeScheduledEventTitle } from "@/lib/title-normalization";

const patchSchema = z
  .object({
    summary: z.string().min(1).max(200).optional(),
    subtitle: z.string().max(100).nullable().optional(),
    eventType: z.enum(VENUE_TONE_VALUES).optional(),
    sportCode: nullableSportCodeSchema.optional(),
    opponent: z.string().max(120).nullable().optional(),
    locationId: z.string().cuid().nullable().optional(),
    revertTitle: z.literal(true).optional(),
    revertHomeAway: z.literal(true).optional(),
    revertLocation: z.literal(true).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.opponent !== undefined && value.eventType === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["eventType"],
        message: "Event type is required when changing the opponent",
      });
    }
    if (value.revertHomeAway && (value.eventType !== undefined || value.sportCode !== undefined || value.opponent !== undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["revertHomeAway"],
        message: "Restore calendar value cannot be combined with event classification edits",
      });
    }
  })
  .refine(
    (v) =>
      v.summary !== undefined ||
      v.subtitle !== undefined ||
      v.eventType !== undefined ||
      v.sportCode !== undefined ||
      v.opponent !== undefined ||
      v.locationId !== undefined ||
      v.revertTitle !== undefined ||
      v.revertHomeAway !== undefined ||
      v.revertLocation !== undefined,
    { message: "At least one field is required" },
  );

export const PATCH = withAuth<{ id: string }>(async (req, { user, params }) => {
  if (user.role !== "ADMIN" && user.role !== "STAFF") {
    throw new HttpError(403, "Only staff and admins can edit events");
  }

  const { id } = params;
  const rawBody = await req.json().catch(() => {
    throw new HttpError(400, "Invalid JSON body");
  });
  const body = patchSchema.parse(rawBody);

  const updated = await db.$transaction(async (tx) => {
    const existing = await tx.calendarEvent.findUnique({
      where: { id },
      select: {
        id: true,
        summary: true,
        subtitle: true,
        sportCode: true,
        isHome: true,
        locationId: true,
        rawSummary: true,
        rawLocationText: true,
        opponent: true,
        summaryLocked: true,
        isHomeLocked: true,
        locationLocked: true,
        location: { select: { isHomeVenue: true } },
      },
    });
    if (!existing) throw new HttpError(404, "Event not found");

    const patch: Record<string, unknown> = {};
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};

    if (body.subtitle !== undefined) {
      before.subtitle = existing.subtitle;
      patch.subtitle = body.subtitle === "" ? null : body.subtitle;
      after.subtitle = patch.subtitle;
    }

    if (body.revertTitle) {
      before.summary = existing.summary;
      before.summaryLocked = existing.summaryLocked;
      const derived = existing.rawSummary
        ? cleanSummary(existing.rawSummary)
        : existing.summary;
      patch.summary = normalizeScheduledEventTitle(derived);
      patch.summaryLocked = false;
      after.summary = patch.summary;
      after.summaryLocked = false;
    } else if (body.summary !== undefined) {
      before.summary = existing.summary;
      before.summaryLocked = existing.summaryLocked;
      patch.summary = normalizeScheduledEventTitle(body.summary);
      patch.summaryLocked = true;
      after.summary = patch.summary;
      after.summaryLocked = true;
    }

    if (body.revertHomeAway) {
      before.isHome = existing.isHome;
      before.isHomeLocked = existing.isHomeLocked;
      before.opponent = existing.opponent;
      before.sportCode = existing.sportCode;
      let derived: boolean | null = null;
      let derivedOpponent: string | null = null;
      let derivedSportCode: string | null = null;
      if (existing.rawSummary) {
        const cleaned = cleanSummary(existing.rawSummary);
        const info = extractSportInfo(cleaned);
        derived = info.isHome;
        derivedOpponent = info.opponent;
        derivedSportCode = info.sportCode;
        const locationText = normalizeVenueText(existing.rawLocationText) || "";
        if (locationText) {
          const homeByLocation = existing.location?.isHomeVenue === true || isHomeLocationText(locationText);
          if (derived === null) derived = homeByLocation;
          else if (derived === true && !homeByLocation) derived = null;
        }
      }
      patch.isHome = derived;
      patch.opponent = derivedOpponent;
      patch.sportCode = derivedSportCode;
      patch.isHomeLocked = false;
      after.isHome = derived;
      after.opponent = derivedOpponent;
      after.sportCode = derivedSportCode;
      after.isHomeLocked = false;
    } else if (body.eventType !== undefined) {
      const normalizedOpponent = body.eventType === "non-game"
        ? null
        : normalizeOpponentName(body.opponent ?? existing.opponent);
      const effectiveSportCode = body.sportCode !== undefined ? body.sportCode : existing.sportCode;
      if (body.eventType !== "non-game" && !effectiveSportCode) {
        throw new HttpError(400, "Sport is required for a game event");
      }
      if (body.eventType !== "non-game" && !normalizedOpponent) {
        throw new HttpError(400, "Opponent is required for a game event");
      }

      before.isHome = existing.isHome;
      before.isHomeLocked = existing.isHomeLocked;
      before.opponent = existing.opponent;
      before.sportCode = existing.sportCode;
      patch.isHome = isHomeFromVenueTone(body.eventType);
      patch.opponent = normalizedOpponent;
      patch.sportCode = effectiveSportCode;
      patch.isHomeLocked = true;
      after.isHome = patch.isHome;
      after.opponent = patch.opponent;
      after.sportCode = patch.sportCode;
      after.isHomeLocked = true;
    } else if (body.sportCode !== undefined) {
      if (existing.opponent && !body.sportCode) {
        throw new HttpError(400, "Sport is required for a game event");
      }
      before.sportCode = existing.sportCode;
      before.isHomeLocked = existing.isHomeLocked;
      patch.sportCode = body.sportCode;
      patch.isHomeLocked = true;
      after.sportCode = patch.sportCode;
      after.isHomeLocked = true;
    }

    if (body.revertLocation) {
      before.locationId = existing.locationId;
      before.locationLocked = existing.locationLocked;
      patch.locationLocked = false;
      after.locationId = existing.locationId;
      after.locationLocked = false;
    } else if (body.locationId !== undefined) {
      before.locationId = existing.locationId;
      before.locationLocked = existing.locationLocked;
      patch.locationId = body.locationId;
      patch.locationLocked = body.locationId !== null;
      after.locationId = body.locationId;
      after.locationLocked = patch.locationLocked;
    }

    const result = await tx.calendarEvent.update({
      where: { id },
      data: patch,
      select: {
        id: true,
        summary: true,
        subtitle: true,
        sportCode: true,
        isHome: true,
        opponent: true,
        locationId: true,
        summaryLocked: true,
        isHomeLocked: true,
        locationLocked: true,
        location: { select: { id: true, name: true } },
      },
    });

    await createAuditEntryTx(tx, {
      actorId: user.id,
      actorRole: user.role,
      entityType: "calendar_event",
      entityId: id,
      action: "calendar_event_updated",
      before,
      after,
    });

    return result;
  });

  return ok({ data: updated });
});

export const GET = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "calendar_source", "view");
  const { id } = params;

  const event = await db.calendarEvent.findUnique({
    where: { id },
    include: {
      location: { select: { id: true, name: true } },
      source: { select: { id: true, name: true } }
    }
  });

  if (!event) {
    throw new HttpError(404, "Event not found");
  }

  return ok({ data: event });
});
