export type SerializedItem = {
  id: string;
  allocationStatus?: string;
  asset: {
    id: string;
    assetTag: string;
    brand: string;
    model: string;
    serialNumber: string;
    type: string;
    imageUrl?: string | null;
    location?: { id: string; name: string };
  };
};

export type BulkItem = {
  id: string;
  plannedQuantity: number;
  checkedOutQuantity: number | null;
  checkedInQuantity: number | null;
  bulkSku: { id: string; name: string; category: string; unit: string; imageUrl?: string | null };
};

export type AuditEntry = {
  id: string;
  action: string;
  createdAt: string;
  beforeJson: Record<string, unknown> | null;
  afterJson: Record<string, unknown> | null;
  actor: { id: string; name: string } | null;
};

export type LocationInfo = { id: string; name: string };

export type BookingDetail = {
  id: string;
  kind: "RESERVATION" | "CHECKOUT";
  title: string;
  refNumber: string | null;
  status: string;
  startsAt: string;
  endsAt: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  location: LocationInfo;
  requester: { id: string; name: string; email: string };
  creator?: { id: string; name: string; email: string };
  serializedItems: SerializedItem[];
  bulkItems: BulkItem[];
  isOverdue: boolean;
  isActive: boolean;
  bookingType: string;
  auditLogs: AuditEntry[];
  hasMoreAuditLogs?: boolean;
  auditLogNextCursor?: string | null;
  itemLocations: LocationInfo[];
  locationMode: "SINGLE" | "MIXED";
  allowedActions?: string[];
  sourceReservation?: { id: string; refNumber: string | null; title: string } | null;
  event?: { id: string; summary: string; sportCode: string | null; opponent: string | null; isHome: boolean | null } | null;
  sportCode?: string | null;
  shiftAssignment?: { id: string; shift: { area: string } } | null;
  kit?: { id: string; name: string } | null;
  photos?: BookingPhoto[];
};

export type BookingPhoto = {
  id: string;
  phase: "CHECKOUT" | "CHECKIN";
  imageUrl: string;
  createdAt: string;
  actor: { id: string; name: string };
};

export type AvailableAsset = {
  id: string;
  assetTag: string;
  brand: string;
  model: string;
  locationId: string;
};

export type BulkSkuOption = {
  id: string;
  name: string;
  category: string;
  unit: string;
  locationId: string;
  currentQuantity?: number;
};

export type ConflictData = {
  conflicts?: Array<{
    assetId: string;
    conflictingBookingId: string;
    conflictingBookingTitle?: string;
    startsAt: string;
    endsAt: string;
  }>;
};

export type TabKey = "details" | "history";

export type HistoryFilter = "all" | "booking" | "equipment";

export type CheckinProgress = {
  returned: number;
  total: number;
  percent: number;
};
