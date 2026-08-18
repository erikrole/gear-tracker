import { ShiftArea } from "@prisma/client";
import { z } from "zod";
import type { CandidateRecommendation, CandidateScoreSignal } from "@/lib/candidate-scoring-types";

const isoDate = z.string().datetime({ offset: true });

export const bulkAssignmentScopeSchema = z.object({
  sportCode: z.string().trim().min(1).max(40).nullable(),
  rangeStartsAt: isoDate,
  rangeEndsAt: isoDate,
  area: z.nativeEnum(ShiftArea).nullable(),
}).superRefine((scope, ctx) => {
  if (new Date(scope.rangeEndsAt) <= new Date(scope.rangeStartsAt)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["rangeEndsAt"], message: "End date must be after start date" });
  }
});

export const bulkAssignmentProposalSchema = z.object({
  proposalId: z.string().min(1).max(240),
  shiftGroupId: z.string().min(1),
  shiftId: z.string().min(1),
  eventId: z.string().min(1),
  userId: z.string().min(1),
});

export const bulkAssignmentApplySchema = z.object({
  scope: bulkAssignmentScopeSchema,
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  proposals: z.array(bulkAssignmentProposalSchema).min(1).max(500),
});

export type BulkAssignmentScope = z.infer<typeof bulkAssignmentScopeSchema>;
export type BulkAssignmentProposalInput = z.infer<typeof bulkAssignmentProposalSchema>;
export type BulkAssignmentApplyInput = z.infer<typeof bulkAssignmentApplySchema>;

export type BulkAssignmentPreviewProposal = BulkAssignmentProposalInput & {
  eventSummary: string;
  eventStartsAt: string;
  area: ShiftArea;
  workerType: "FT" | "ST";
  userName: string;
  userRole: string;
  score: number;
  bucket: CandidateRecommendation["bucket"];
  reasons: CandidateScoreSignal[];
  warnings: CandidateScoreSignal[];
  advisoryConflict: boolean;
  advisoryConflictNote: string | null;
};

export type BulkAssignmentPreviewSkipped = {
  shiftId: string | null;
  area: ShiftArea | null;
  workerType: "FT" | "ST" | null;
  reasonCode:
    | "no_shift_group"
    | "pending_working_copy"
    | "no_open_slots"
    | "no_visible_candidates"
    | "no_scheduling_class_match"
    | "no_area_fit"
    | "approved_time_off_blocked"
    | "overlapping_assignment_blocked"
    | "already_proposed"
    | "no_safe_candidate";
  reason: string;
  reasonDetails: string[];
};

export type BulkAssignmentPreviewEvent = {
  shiftGroupId: string | null;
  eventId: string;
  summary: string;
  startsAt: string;
  sportCode: string | null;
  workingVersion: number | null;
  publishedVersion: number | null;
  status: "ready" | "skipped";
  proposals: BulkAssignmentPreviewProposal[];
  skipped: BulkAssignmentPreviewSkipped[];
  openSlots: number;
};

export type BulkAssignmentPreviewResponse = {
  generatedAt: string;
  scope: BulkAssignmentScope;
  fingerprint: string;
  events: BulkAssignmentPreviewEvent[];
  summary: {
    eventsMatched: number;
    eventsReady: number;
    openSlots: number;
    proposed: number;
    skipped: number;
    warnings: number;
  };
};
