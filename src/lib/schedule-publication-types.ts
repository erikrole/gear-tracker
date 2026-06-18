export type SchedulePublicationStatus = "draft" | "published" | "changed";

export type SchedulePublicationSnapshotItem = {
  shiftId: string;
  area: string;
  workerType: string;
  startsAt: string;
  endsAt: string;
  callStartsAt: string | null;
  callEndsAt: string | null;
  assignments: Array<{
    id: string;
    userId: string;
    status: string;
    callStartsAt: string | null;
    callEndsAt: string | null;
    callNote: string | null;
  }>;
};

export type SchedulePublicationSnapshot = {
  shifts: SchedulePublicationSnapshotItem[];
};

export type SchedulePublicationState = {
  status: SchedulePublicationStatus;
  publishedAt: string | null;
  publishedById: string | null;
  changedAfterPublish: boolean;
  activeAssignmentCount: number;
  acknowledgedCount: number;
  unacknowledgedCount: number;
};
