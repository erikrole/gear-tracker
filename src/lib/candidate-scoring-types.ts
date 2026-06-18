export type CandidateScoreBucket = "recommended" | "good_fit" | "warning" | "overloaded";

export type CandidateScoreSignal = {
  code: string;
  label: string;
  weight?: number;
};

export type CandidateRecommendation = {
  userId: string;
  bucket: CandidateScoreBucket;
  score: number;
  reasons: CandidateScoreSignal[];
  warnings: CandidateScoreSignal[];
  blockingConflict: boolean;
  advisoryConflict: boolean;
  advisoryConflictNote: string | null;
  workload: {
    weekAssignments: number;
    weekHours: number;
    monthAssignments: number;
    monthHours: number;
    upcomingAssignments: number;
  };
};
