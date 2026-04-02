export type ScanMode = "lookup" | "checkout" | "checkin";

export type ItemReport = {
  type: "DAMAGED" | "LOST";
  description?: string;
};

export type SerializedItemStatus = {
  assetId: string;
  assetTag: string;
  brand: string;
  model: string;
  scanned: boolean;
  report?: ItemReport | null;
};

export type AllocatedUnit = {
  unitNumber: number;
  checkedOut: boolean;
  checkedIn: boolean;
};

export type BulkItemStatus = {
  bulkSkuId: string;
  name: string;
  required: number;
  scanned: number;
  trackByNumber?: boolean;
  allocatedUnits?: AllocatedUnit[];
};

export type ScanStatus = {
  checkoutId: string;
  title: string;
  status: string;
  phase: string;
  requester: { id: string; name: string };
  location: { id: string; name: string };
  serializedItems: SerializedItemStatus[];
  bulkItems: BulkItemStatus[];
  progress: {
    serializedScanned: number;
    serializedTotal: number;
    bulkComplete: boolean;
    allComplete: boolean;
    damagedCount: number;
    lostCount: number;
  };
};

export type LookupResult = {
  id: string;
  assetTag: string;
  brand: string;
  model: string;
  qrCodeValue?: string;
  primaryScanCode?: string;
};

export type ItemPreview = {
  id: string;
  assetTag: string;
  name?: string | null;
  brand: string;
  model: string;
  serialNumber: string;
  imageUrl?: string | null;
  computedStatus: string;
  location: { name: string } | null;
  category: { name: string } | null;
  parentAsset: {
    id: string;
    assetTag: string;
    name: string | null;
    brand: string;
    model: string;
  } | null;
  activeBooking: {
    id: string;
    kind: string;
    title: string;
    startsAt: string;
    endsAt: string;
    requesterName: string;
    requesterAvatarUrl?: string | null;
  } | null;
};

export type ScanFeedbackResult = {
  message: string;
  type: "success" | "error" | "info";
} | null;

export type UnitPickerState = {
  bulkSkuId: string;
  scanValue: string;
  name: string;
  availableUnits: number[];
} | null;
