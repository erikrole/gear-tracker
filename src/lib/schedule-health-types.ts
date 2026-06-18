import type { ScheduleChangeHistorySnapshot } from "@/lib/schedule-change-history-types";

export type ScheduleHealthQueue = {
  count: number;
  eventCount?: number;
  eventIds?: string[];
};

export type ScheduleHealthNextCall = {
  eventId: string | null;
  summary: string | null;
  startsAt: string | null;
  label: string;
};

export type ScheduleGearAssignmentStatus =
  | "reserved"
  | "awaiting_pickup"
  | "checked_out"
  | "missing";

export type ScheduleGearAssignmentReadiness = {
  eventId: string;
  assignmentId: string;
  userId: string;
  bookingId: string | null;
  status: ScheduleGearAssignmentStatus;
  linkType: "assignment" | "event" | "missing";
};

export type ScheduleGearEventReadiness = {
  eventId: string;
  counts: {
    ready: number;
    reserved: number;
    awaitingPickup: number;
    checkedOut: number;
    missing: number;
    notLinked: number;
  };
  assignmentIds: string[];
};

export type ScheduleGearReadinessSnapshot = {
  events: Record<string, ScheduleGearEventReadiness>;
  assignments: Record<string, ScheduleGearAssignmentReadiness>;
  queues: {
    missingGear: ScheduleHealthQueue;
    unlinkedAssignmentGear: ScheduleHealthQueue;
  };
};

export type ScheduleHealthSnapshot = {
  window: {
    startsAt: string | null;
    endsAt: string | null;
    includePast: boolean;
    includeArchived: boolean;
    sportCode: string | null;
  };
  nextCall: ScheduleHealthNextCall;
  queues: {
    openSlots: ScheduleHealthQueue;
    eventsWithoutCrew: ScheduleHealthQueue;
    coveredEvents: ScheduleHealthQueue & { totalVisibleEvents: number };
    myShifts: ScheduleHealthQueue;
    pendingRequests: ScheduleHealthQueue;
    conflicts: ScheduleHealthQueue;
    openTrades: ScheduleHealthQueue;
    tradeApprovals: ScheduleHealthQueue;
    gearGaps: ScheduleHealthQueue;
    hiddenEvents: ScheduleHealthQueue;
    archivedEvents: ScheduleHealthQueue;
  };
  gearReadiness: ScheduleGearReadinessSnapshot;
  changeHistory: ScheduleChangeHistorySnapshot;
  partialFailures: string[];
};
