export type ShiftRecordSportStats = {
  sportCode: string;
  sportLabel: string;
  shiftCount: number;
  resultEventCount: number;
  wins: number;
  losses: number;
};

export type ShiftRecordStats = {
  shiftCount: number;
  resultEventCount: number;
  wins: number;
  losses: number;
  bySport: ShiftRecordSportStats[];
};
