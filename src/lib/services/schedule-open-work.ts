import { Prisma, type Role, type ShiftArea, type ShiftAssignmentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { ACTIVE_ASSIGNMENT_STATUSES } from "@/lib/shift-constants";
import { scoreCandidatesForShift, type CandidateScoringUser } from "@/lib/services/candidate-scoring";
import { evaluateAvailabilityPreferences } from "@/lib/student-availability";
import { availabilityContextFromCandidate } from "@/lib/schedule-availability-context";
import { shiftWorkerTypeForProfile } from "@/lib/shift-display";

const ACTIVE_STATUSES = ACTIVE_ASSIGNMENT_STATUSES as ShiftAssignmentStatus[];

type OpenWorkFilters = {
  userId: string;
  role: Role;
  area?: ShiftArea;
  now?: Date;
  limit?: number;
};

type OpenWorkShift = Awaited<ReturnType<typeof loadOpenShiftRows>>[number];

function effectiveWindow(item: {
  startsAt: Date;
  endsAt: Date;
  callStartsAt?: Date | null;
  callEndsAt?: Date | null;
}) {
  return {
    startsAt: item.callStartsAt ?? item.startsAt,
    endsAt: item.callEndsAt ?? item.endsAt,
  };
}

function futureEffectiveShiftWhere(now: Date): Prisma.ShiftWhereInput {
  return {
    OR: [
      { callStartsAt: null, startsAt: { gt: now } },
      { callStartsAt: { gt: now } },
    ],
  };
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function openShiftSelect() {
  return {
    id: true,
    area: true,
    workerType: true,
    startsAt: true,
    endsAt: true,
    callStartsAt: true,
    callEndsAt: true,
    assignments: {
      where: { status: "REQUESTED" as const },
      select: {
        id: true,
        userId: true,
        status: true,
        hasConflict: true,
        conflictNote: true,
        user: { select: { id: true, name: true, primaryArea: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "asc" as const },
    },
    shiftGroup: {
      select: {
        id: true,
        publishedAt: true,
        event: {
          select: {
            id: true,
            summary: true,
            startsAt: true,
            endsAt: true,
            sportCode: true,
            opponent: true,
            isHome: true,
          },
        },
      },
    },
  };
}

async function loadCurrentCandidate(userId: string, now: Date, futureEnd: Date): Promise<CandidateScoringUser | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      staffingType: true,
      active: true,
      primaryArea: true,
      areaAssignments: { select: { area: true, isPrimary: true } },
      sportAssignments: { select: { sportCode: true } },
      availabilityBlocks: {
        select: {
          kind: true,
          intent: true,
          status: true,
          dayOfWeek: true,
          date: true,
          startsAt: true,
          endsAt: true,
          label: true,
          semesterLabel: true,
          semesterStartsOn: true,
          semesterEndsOn: true,
        },
      },
    },
  });
  if (!user || !user.active) return null;

  const assignments = await db.shiftAssignment.findMany({
    where: {
      userId,
      status: { in: ACTIVE_STATUSES },
      OR: [
        { shift: { startsAt: { lt: futureEnd }, endsAt: { gt: now } } },
        { callStartsAt: { lt: futureEnd }, callEndsAt: { gt: now } },
        { shift: { callStartsAt: { lt: futureEnd }, callEndsAt: { gt: now } } },
      ],
    },
    select: {
      id: true,
      status: true,
      callStartsAt: true,
      callEndsAt: true,
      shift: {
        select: {
          id: true,
          area: true,
          startsAt: true,
          endsAt: true,
          callStartsAt: true,
          callEndsAt: true,
          shiftGroup: {
            select: { event: { select: { sportCode: true } } },
          },
        },
      },
    },
  });

  return {
    id: user.id,
    role: user.role,
    staffingType: user.staffingType,
    primaryArea: user.primaryArea,
    areaAssignments: user.areaAssignments,
    sportAssignments: user.sportAssignments,
    availabilityBlocks: user.availabilityBlocks,
    assignments,
  };
}

async function loadOpenShiftRows(filters: OpenWorkFilters) {
  const now = filters.now ?? new Date();
  return db.shift.findMany({
    where: {
      AND: [futureEffectiveShiftWhere(now)],
      ...(filters.area ? { area: filters.area } : {}),
      workerType: "ST",
      assignments: {
        none: { status: { in: ACTIVE_STATUSES } },
      },
      shiftGroup: {
        publishedAt: { not: null },
        archivedAt: null,
        event: {
          isHidden: false,
          archivedAt: null,
          status: { not: "CANCELLED" },
        },
      },
    },
    select: openShiftSelect(),
    orderBy: { startsAt: "asc" },
    take: filters.limit ?? 50,
  });
}

function shiftToScoreInput(shift: OpenWorkShift) {
  return {
    id: shift.id,
    area: shift.area,
    workerType: shift.workerType,
    startsAt: shift.startsAt,
    endsAt: shift.endsAt,
    callStartsAt: shift.callStartsAt,
    callEndsAt: shift.callEndsAt,
    sportCode: shift.shiftGroup.event.sportCode,
  };
}

function openShiftBlockedReason(recommendation: ReturnType<typeof scoreCandidatesForShift>[number] | null) {
  const approvedTimeOff = recommendation?.warnings.find((warning) => warning.code === "approved_time_off");
  if (approvedTimeOff) return approvedTimeOff.label;
  const overlappingAssignment = recommendation?.warnings.find((warning) => warning.code === "overlapping_assignment");
  if (overlappingAssignment) return overlappingAssignment.label;
  if (recommendation?.blockingConflict) return recommendation.advisoryConflictNote ?? "This shift is blocked by your current schedule.";
  return null;
}

function serializeOpenShift(shift: OpenWorkShift, args: {
  userId: string;
  role: Role;
  candidate: CandidateScoringUser | null;
  now: Date;
}) {
  const recommendation = args.candidate
    ? scoreCandidatesForShift({
      shift: shiftToScoreInput(shift),
      candidates: [args.candidate],
      now: args.now,
    })[0] ?? null
    : null;
  const ownRequest = shift.assignments.find((assignment) => assignment.userId === args.userId) ?? null;
  const isStudentWorker = args.candidate?.staffingType === "ST";
  const availabilityContext = availabilityContextFromCandidate(recommendation);
  const blockedReason = openShiftBlockedReason(recommendation);
  const canAct = isStudentWorker && shift.workerType === "ST" && !recommendation?.blockingConflict;
  const action = !canAct || !isStudentWorker || shift.workerType !== "ST" || recommendation?.blockingConflict
    ? "none"
    : "claim";

  return {
    id: shift.id,
    kind: "open_shift" as const,
    action,
    canAct,
    reason: blockedReason
        ? blockedReason
        : "Instant pickup",
    availabilityContext,
    score: recommendation?.score ?? null,
    bucket: recommendation?.bucket ?? null,
    advisoryConflict: recommendation?.advisoryConflict ?? false,
    advisoryConflictNote: recommendation?.advisoryConflictNote ?? null,
    warnings: recommendation?.warnings ?? [],
    reasons: recommendation?.reasons ?? [],
    ownRequestId: ownRequest?.id ?? null,
    requestCount: shift.assignments.length,
    shift: {
      id: shift.id,
      area: shift.area,
      workerType: shift.workerType,
      startsAt: shift.startsAt.toISOString(),
      endsAt: shift.endsAt.toISOString(),
      callStartsAt: shift.callStartsAt?.toISOString() ?? null,
      callEndsAt: shift.callEndsAt?.toISOString() ?? null,
      shiftGroup: {
        id: shift.shiftGroup.id,
        publishedAt: shift.shiftGroup.publishedAt?.toISOString() ?? null,
        event: {
          ...shift.shiftGroup.event,
          startsAt: shift.shiftGroup.event.startsAt.toISOString(),
          endsAt: shift.shiftGroup.event.endsAt.toISOString(),
        },
      },
    },
  };
}

export async function getScheduleOpenWork(filters: OpenWorkFilters) {
  const now = filters.now ?? new Date();
  const futureEnd = addDays(now, 120);
  const [candidate, shifts, pickupRequests] = await Promise.all([
    loadCurrentCandidate(filters.userId, now, futureEnd),
    loadOpenShiftRows({ ...filters, now }),
    filters.role === "ADMIN" || filters.role === "STAFF"
      ? db.shiftAssignment.findMany({
        where: {
          status: "REQUESTED",
          ...(filters.area ? { shift: { area: filters.area } } : {}),
          shift: {
            AND: [futureEffectiveShiftWhere(now)],
            ...(filters.area ? { area: filters.area } : {}),
            shiftGroup: {
              publishedAt: { not: null },
              archivedAt: null,
              event: { isHidden: false, archivedAt: null, status: { not: "CANCELLED" } },
            },
          },
        },
        select: {
          id: true,
          status: true,
          hasConflict: true,
          conflictNote: true,
          createdAt: true,
          user: { select: { id: true, name: true, primaryArea: true, avatarUrl: true } },
          shift: { select: openShiftSelect() },
        },
        orderBy: { createdAt: "asc" },
        take: filters.limit ?? 50,
      })
      : Promise.resolve([]),
  ]);

  return {
    openShifts: shifts.map((shift) => serializeOpenShift(shift, {
      userId: filters.userId,
      role: filters.role,
      candidate,
      now,
    })),
    pickupRequests: pickupRequests.map((request) => ({
      id: request.id,
      kind: "pickup_request" as const,
      status: request.status,
      hasConflict: request.hasConflict,
      conflictNote: request.conflictNote,
      createdAt: request.createdAt.toISOString(),
      user: request.user,
      shift: serializeOpenShift(request.shift, {
        userId: request.user.id,
        role: "STUDENT",
        candidate: null,
        now,
      }).shift,
    })),
  };
}

export async function pickupOpenShift(shiftId: string, userId: string) {
  return db.$transaction(async (tx) => {
    const [shift, user] = await Promise.all([
      tx.shift.findUnique({
        where: { id: shiftId },
        include: {
          assignments: {
            where: { status: { in: ["DIRECT_ASSIGNED", "APPROVED", "REQUESTED"] } },
          },
          shiftGroup: {
            include: {
              event: { select: { isHidden: true, archivedAt: true, status: true } },
            },
          },
        },
      }),
      tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          role: true,
          staffingType: true,
          active: true,
          availabilityBlocks: {
            select: {
              kind: true,
              intent: true,
              status: true,
              dayOfWeek: true,
              date: true,
              startsAt: true,
              endsAt: true,
              label: true,
              semesterLabel: true,
              semesterStartsOn: true,
              semesterEndsOn: true,
            },
          },
        },
      }),
    ]);

    if (!shift) throw new HttpError(404, "Shift not found");
    if (!user || !user.active) throw new HttpError(400, "Cannot claim a shift for an inactive user");
    if (shiftWorkerTypeForProfile(user) !== "ST" || shift.workerType !== "ST") {
      throw new HttpError(400, "Open pickup is available for Student slots only");
    }
    if (!shift.shiftGroup.publishedAt) throw new HttpError(400, "Draft shifts are not open for pickup");
    if (shift.shiftGroup.archivedAt || shift.shiftGroup.event.archivedAt || shift.shiftGroup.event.isHidden || shift.shiftGroup.event.status === "CANCELLED") {
      throw new HttpError(400, "This shift is not open for pickup");
    }
    const window = effectiveWindow(shift);
    if (window.startsAt <= new Date()) throw new HttpError(400, "This shift has already started");

    const activeAssignment = shift.assignments.find((assignment) =>
      (ACTIVE_STATUSES as readonly ShiftAssignmentStatus[]).includes(assignment.status)
    );
    if (activeAssignment) throw new HttpError(409, "This shift already has an active assignment");

    const conflictWhere: Prisma.ShiftAssignmentWhereInput = {
      userId,
      status: { in: ACTIVE_STATUSES },
      OR: [
        { shift: { startsAt: { lt: window.endsAt }, endsAt: { gt: window.startsAt } } },
        { callStartsAt: { lt: window.endsAt }, callEndsAt: { gt: window.startsAt } },
        { shift: { callStartsAt: { lt: window.endsAt }, callEndsAt: { gt: window.startsAt } } },
      ],
    };
    const hardConflict = await tx.shiftAssignment.findFirst({
      where: conflictWhere,
      select: { id: true, shift: { select: { area: true } } },
    });
    if (hardConflict) {
      throw new HttpError(409, `User already has a shift during this time (${hardConflict.shift.area})`);
    }

    const availability = evaluateAvailabilityPreferences(user.availabilityBlocks, window);
    if (availability.blocking) {
      throw new HttpError(409, availability.blocking.note);
    }
    const conflictNote = availability.advisory?.note ?? null;
    await tx.shiftAssignment.updateMany({
      where: { shiftId, status: "REQUESTED" },
      data: { status: "DECLINED" },
    });

    return tx.shiftAssignment.create({
      data: {
        shiftId,
        userId,
        status: "DIRECT_ASSIGNED",
        assignedBy: userId,
        hasConflict: Boolean(conflictNote),
        conflictNote,
        acknowledgedAt: new Date(),
        acknowledgedById: userId,
      },
      include: {
        user: { select: { id: true, name: true, role: true, staffingType: true, primaryArea: true, avatarUrl: true } },
        shift: {
          include: {
            shiftGroup: { include: { event: true } },
          },
        },
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
