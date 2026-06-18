import { ShiftAssignmentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import type { CandidateRecommendation } from "@/lib/candidate-scoring-types";
import type {
  AutoFillPreviewProposal,
  AutoFillPreviewResponse,
  AutoFillPreviewSkippedSlot,
} from "@/lib/auto-fill-preview-types";
import { getCandidateScoresForShift } from "@/lib/services/candidate-scoring";
import { ACTIVE_ASSIGNMENT_STATUSES } from "@/lib/shift-constants";

type PreviewShift = {
  id: string;
  area: string;
  workerType: string;
  startsAt: Date;
  assignments: Array<{ status: ShiftAssignmentStatus | string }>;
};

type PreviewUser = {
  id: string;
  name: string;
  role: string;
};

type BuildPreviewArgs = {
  shiftGroupId: string;
  eventId: string;
  eventSummary: string;
  generatedAt: Date;
  shifts: PreviewShift[];
  users: PreviewUser[];
  scoresByShiftId: Record<string, CandidateRecommendation[]>;
};

const ACTIVE_STATUSES = new Set<string>(ACTIVE_ASSIGNMENT_STATUSES);
const AREA_ORDER = ["VIDEO", "PHOTO", "GRAPHICS", "COMMS"] as const;
const AREA_RANK = new Map<string, number>(AREA_ORDER.map((area, index) => [area, index]));

function roleMatchesShift(workerType: string, role: string) {
  if (workerType === "ST") return role === "STUDENT";
  return role === "STAFF" || role === "ADMIN";
}

function isOpenShift(shift: PreviewShift) {
  return !shift.assignments.some((assignment) => ACTIVE_STATUSES.has(assignment.status));
}

function hasAreaFit(score: CandidateRecommendation) {
  return score.reasons.some((reason) => reason.code === "primary_area" || reason.code === "area_assignment");
}

function sortOpenShifts(a: PreviewShift, b: PreviewShift) {
  return a.startsAt.getTime() - b.startsAt.getTime()
    || (AREA_RANK.get(a.area) ?? AREA_ORDER.length) - (AREA_RANK.get(b.area) ?? AREA_ORDER.length)
    || a.workerType.localeCompare(b.workerType)
    || a.id.localeCompare(b.id);
}

export function buildAutoFillPreview({
  shiftGroupId,
  eventId,
  eventSummary,
  generatedAt,
  shifts,
  users,
  scoresByShiftId,
}: BuildPreviewArgs): AutoFillPreviewResponse {
  const usersById = new Map(users.map((user) => [user.id, user]));
  const usedUserIds = new Set<string>();
  const proposals: AutoFillPreviewProposal[] = [];
  const skipped: AutoFillPreviewSkippedSlot[] = [];
  const openShifts = shifts.filter(isOpenShift).sort(sortOpenShifts);

  for (const shift of openShifts) {
    const scores = scoresByShiftId[shift.id] ?? [];
    const eligibleScores = scores.filter((score) => {
      const user = usersById.get(score.userId);
      if (!user) return false;
      if (usedUserIds.has(score.userId)) return false;
      if (score.blockingConflict) return false;
      if (!roleMatchesShift(shift.workerType, user.role)) return false;
      if (!hasAreaFit(score)) return false;
      return true;
    });
    const chosen = eligibleScores[0];

    if (!chosen) {
      skipped.push({
        shiftId: shift.id,
        area: shift.area,
        workerType: shift.workerType,
        reason: "No role and area matched candidate without a blocking overlap.",
        blockingCandidateCount: scores.filter((score) => score.blockingConflict).length,
      });
      continue;
    }

    const user = usersById.get(chosen.userId)!;
    usedUserIds.add(chosen.userId);
    proposals.push({
      shiftId: shift.id,
      area: shift.area,
      workerType: shift.workerType,
      userId: chosen.userId,
      userName: user.name,
      userRole: user.role,
      score: chosen.score,
      bucket: chosen.bucket,
      reasons: chosen.reasons,
      warnings: chosen.warnings,
      advisoryConflict: chosen.advisoryConflict,
      advisoryConflictNote: chosen.advisoryConflictNote,
    });
  }

  return {
    shiftGroupId,
    eventId,
    eventSummary,
    generatedAt: generatedAt.toISOString(),
    proposals,
    skipped,
    summary: {
      openSlots: openShifts.length,
      proposed: proposals.length,
      skipped: skipped.length,
      warnings: proposals.filter((proposal) => proposal.warnings.length > 0).length,
    },
  };
}

export async function getAutoFillPreview(shiftGroupId: string): Promise<AutoFillPreviewResponse> {
  const group = await db.shiftGroup.findUnique({
    where: { id: shiftGroupId },
    select: {
      id: true,
      eventId: true,
      event: { select: { summary: true } },
      shifts: {
        select: {
          id: true,
          area: true,
          workerType: true,
          startsAt: true,
          assignments: {
            select: { status: true },
          },
        },
        orderBy: [{ startsAt: "asc" }, { area: "asc" }, { workerType: "asc" }, { id: "asc" }],
      },
    },
  });

  if (!group) throw new HttpError(404, "Shift group not found");

  const openShifts = group.shifts.filter(isOpenShift);
  const [users, scorePairs] = await Promise.all([
    db.user.findMany({
      where: { active: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
    Promise.all(openShifts.map(async (shift) => [shift.id, await getCandidateScoresForShift(shift.id)] as const)),
  ]);

  return buildAutoFillPreview({
    shiftGroupId: group.id,
    eventId: group.eventId,
    eventSummary: group.event.summary,
    generatedAt: new Date(),
    shifts: group.shifts,
    users,
    scoresByShiftId: Object.fromEntries(scorePairs),
  });
}
