import type { CandidateRecommendation, CandidateScoreSignal } from "@/lib/candidate-scoring-types";

export type AutoFillPreviewProposal = {
  shiftId: string;
  area: string;
  workerType: string;
  userId: string;
  userName: string;
  userRole: string;
  score: number;
  bucket: CandidateRecommendation["bucket"];
  reasons: CandidateScoreSignal[];
  warnings: CandidateScoreSignal[];
  advisoryConflict: boolean;
  advisoryConflictNote: string | null;
};

export type AutoFillPreviewSkippedSlot = {
  shiftId: string;
  area: string;
  workerType: string;
  reason: string;
  blockingCandidateCount: number;
};

export type AutoFillPreviewResponse = {
  shiftGroupId: string;
  eventId: string;
  eventSummary: string;
  generatedAt: string;
  proposals: AutoFillPreviewProposal[];
  skipped: AutoFillPreviewSkippedSlot[];
  summary: {
    openSlots: number;
    proposed: number;
    skipped: number;
    warnings: number;
  };
};
