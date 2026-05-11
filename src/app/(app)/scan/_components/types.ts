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
