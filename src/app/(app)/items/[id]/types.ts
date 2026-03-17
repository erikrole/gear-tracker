/* ── Shared types for Item Detail page and sub-components ── */

export type ActiveBookingDetail = {
  id: string;
  kind: string;
  status: string;
  title: string;
  startsAt: string;
  endsAt: string;
  requesterName: string;
};

export type UpcomingReservation = {
  bookingId: string;
  title: string;
  status: string;
  startsAt: string;
  endsAt: string;
  requesterName: string;
};

export type AssetDetail = {
  id: string;
  assetTag: string;
  name: string | null;
  type: string;
  brand: string;
  model: string;
  serialNumber: string;
  qrCodeValue: string;
  purchaseDate: string | null;
  purchasePrice: string | number | null;
  warrantyDate: string | null;
  residualValue: string | number | null;
  status: string;
  computedStatus: string;
  notes: string | null;
  linkUrl: string | null;
  location: { name: string };
  department: { name: string } | null;
  category: { id: string; name: string } | null;
  availableForReservation: boolean;
  availableForCheckout: boolean;
  availableForCustody: boolean;
  metadata: Record<string, string> | null;
  activeBooking: ActiveBookingDetail | null;
  hasBookingHistory: boolean;
  parentAsset: { id: string; assetTag: string; name: string | null; brand: string; model: string } | null;
  accessories: Array<{
    id: string;
    assetTag: string;
    name: string | null;
    brand: string;
    model: string;
    serialNumber: string;
    status: string;
    type: string;
    imageUrl: string | null;
  }>;
  upcomingReservations: UpcomingReservation[];
  history: Array<{
    id: string;
    createdAt: string;
    booking: {
      id: string;
      kind: "RESERVATION" | "CHECKOUT";
      status: string;
      title: string;
      startsAt: string;
      endsAt: string;
      sportCode?: string | null;
      requester: { name: string; email: string };
      location: { name: string };
      event?: {
        id: string;
        summary: string;
        sportCode: string | null;
        opponent: string | null;
        isHome: boolean | null;
        startsAt: string;
        endsAt: string;
      } | null;
    };
  }>;
};

export type CategoryOption = { id: string; name: string; parentId: string | null };
