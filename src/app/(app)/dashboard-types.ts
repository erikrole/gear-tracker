/* Dashboard shared types — used by page.tsx, hooks, and section components */

/** Shape returned by /api/dashboard/stats — lightweight, 60s TTL */
export type DashboardStats = {
  role: "ADMIN" | "STAFF" | "STUDENT";
  stats: {
    checkedOut: number;
    overdue: number;
    reserved: number;
    dueToday: number;
  };
  overdueCount: number;
  myCheckoutsTotal: number;
  myOverdueCount: number;
  teamCheckoutsTotal: number;
  teamCheckoutsOverdue: number;
  teamReservationsTotal: number;
  pendingPickupTotal: number;
  staleReservationTotal: number;
};

export type ItemThumb = {
  id: string;
  name: string | null;
  imageUrl: string | null;
};

export type BookingSummary = {
  id: string;
  kind: string;
  title: string;
  refNumber: string | null;
  eventId: string | null;
  eventIds: string[];
  linkedEventId: string | null;
  sportCode: string | null;
  requesterName: string;
  requesterInitials: string;
  requesterAvatarUrl: string | null;
  locationName: string | null;
  startsAt: string;
  endsAt: string;
  itemCount: number;
  status: string;
  isOverdue: boolean;
  items: ItemThumb[];
};

export type MyReservation = {
  id: string;
  title: string;
  refNumber: string | null;
  sportCode: string | null;
  requesterName: string;
  requesterInitials: string;
  requesterAvatarUrl: string | null;
  startsAt: string;
  endsAt: string;
  itemCount: number;
  locationName: string | null;
  items: ItemThumb[];
};

export type EventSummary = {
  id: string;
  title: string;
  sportCode: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  location: string | null;
  locationId: string | null;
  opponent: string | null;
  isHome: boolean | null;
  coverage: { total: number; filled: number; percentage: number } | null;
  callTime: string | null;
  totalShiftSlots: number;
  filledShiftSlots: number;
  assignedUsers: Array<{ id: string; name: string; avatarUrl: string | null; area: string | null }>;
};

export type OverdueItem = {
  bookingId: string;
  bookingTitle: string;
  requesterName: string;
  requesterInitials: string;
  requesterAvatarUrl: string | null;
  assetTags: string[];
  endsAt: string;
  items: ItemThumb[];
};

export type DraftSummary = {
  id: string;
  kind: string;
  title: string;
  itemCount: number;
  updatedAt: string;
};

export type MyShift = {
  id: string;
  area: string;
  workerType: string;
  workerLabel: string;
  startsAt: string;
  endsAt: string;
  callStartsAt: string;
  callEndsAt: string;
  callNote: string | null;
  event: {
    id: string;
    summary: string;
    startsAt: string;
    endsAt: string;
    sportCode: string | null;
    opponent: string | null;
    isHome: boolean | null;
    locationId: string | null;
    locationName: string | null;
  };
  gearStatus: string;
  gearItems: ItemThumb[];
  gearItemCount: number;
};

export type MyEventWork = {
  id: string;
  event: {
    id: string;
    summary: string;
    startsAt: string;
    endsAt: string;
    allDay: boolean;
    sportCode: string | null;
    opponent: string | null;
    isHome: boolean | null;
    locationId: string | null;
    locationName: string | null;
  };
  shift: {
    id: string;
    area: string;
    workerType: string;
    workerLabel: string;
    startsAt: string;
    endsAt: string;
    callStartsAt: string;
    callEndsAt: string;
    callNote: string | null;
  };
  gearStatus: string;
  gearBookings: BookingSummary[];
  needsGear: boolean;
};

export type CreateBookingContext = {
  kind: "CHECKOUT" | "RESERVATION";
  title?: string;
  startsAt?: string;
  endsAt?: string;
  locationId?: string;
  eventId?: string;
  sportCode?: string;
};

export type FlaggedItem = {
  id: string;
  assetId: string;
  assetTag: string;
  assetName: string | null;
  type: "DAMAGED" | "LOST" | "MAINTENANCE";
  bookingTitle: string | null;
  reportedBy: string | null;
  imageUrl?: string | null;
  createdAt: string;
};

export type LostBulkUnitSummary = {
  skuName: string;
  count: number;
};

export type DashboardData = {
  role: string;
  stats: {
    checkedOut: number;
    overdue: number;
    reserved: number;
    dueToday: number;
  };
  myCheckouts: { total: number; overdue: number; items: BookingSummary[] };
  teamCheckouts: { total: number; overdue: number; items: BookingSummary[] };
  teamReservations: { total: number; items: BookingSummary[] };
  pendingPickups: { total: number; items: BookingSummary[] };
  staleReservations: { total: number; items: BookingSummary[] };
  upcomingEvents: EventSummary[];
  myReservations: BookingSummary[];
  overdueCount: number;
  overdueItems: OverdueItem[];
  drafts: DraftSummary[];
  myShifts: MyShift[];
  myEventWork: MyEventWork[];
  flaggedItems: FlaggedItem[];
  lostBulkUnits: LostBulkUnitSummary[];
};
