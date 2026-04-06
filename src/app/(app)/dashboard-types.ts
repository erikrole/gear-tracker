/* Dashboard shared types — used by page.tsx, hooks, and section components */

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
  totalShiftSlots: number;
  assignedUsers: Array<{ id: string; name: string; initials: string; avatarUrl: string | null; area: string | null }>;
};

export type OverdueItem = {
  bookingId: string;
  bookingTitle: string;
  requesterName: string;
  requesterInitials: string;
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
  startsAt: string;
  endsAt: string;
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
  myCheckouts: { total: number; items: BookingSummary[] };
  teamCheckouts: { total: number; overdue: number; items: BookingSummary[] };
  teamReservations: { total: number; items: BookingSummary[] };
  upcomingEvents: EventSummary[];
  myReservations: MyReservation[];
  overdueCount: number;
  overdueItems: OverdueItem[];
  drafts: DraftSummary[];
  myShifts: MyShift[];
  flaggedItems: FlaggedItem[];
  lostBulkUnits: LostBulkUnitSummary[];
};
