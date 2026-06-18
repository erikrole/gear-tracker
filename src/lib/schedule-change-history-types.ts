export type ScheduleChangeKind =
  | "assignment_assigned"
  | "assignment_removed"
  | "assignment_updated"
  | "shift_created"
  | "shift_updated"
  | "shift_deleted"
  | "published"
  | "republished"
  | "copy_forward_applied"
  | "pickup_requested"
  | "pickup_claimed"
  | "reservation_linked"
  | "event_created"
  | "event_updated"
  | "event_visibility_updated"
  | "shift_group_archived"
  | "unknown";

export type ScheduleChangeItem = {
  id: string;
  eventId: string;
  entityType: string;
  entityId: string;
  action: string;
  kind: ScheduleChangeKind;
  label: string;
  detail: string | null;
  actorId: string | null;
  actorName: string;
  actorRole: string | null;
  createdAt: string;
  target: {
    type: "event" | "shift_group" | "shift" | "assignment" | "booking" | "unknown";
    id: string;
    label: string | null;
  };
  afterPublication: boolean;
  needsReview: boolean;
  source: "audit";
};

export type ScheduleChangeEventSummary = {
  eventId: string;
  count: number;
  latestAt: string | null;
  hasRecentChanges: boolean;
  needsReview: boolean;
  items: ScheduleChangeItem[];
};

export type ScheduleChangeHistorySnapshot = {
  events: Record<string, ScheduleChangeEventSummary>;
};
