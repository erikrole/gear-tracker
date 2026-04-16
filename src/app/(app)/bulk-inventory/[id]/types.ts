export type BulkUnit = {
  id: string;
  unitNumber: number;
  status: "AVAILABLE" | "CHECKED_OUT" | "LOST" | "RETIRED";
  notes: string | null;
  allocations?: Array<{
    bookingBulkItem: {
      booking: { refNumber: string | null; title: string; requester: { name: string } };
    };
  }>;
};

export type BulkSkuDetail = {
  id: string;
  name: string;
  category: string;
  unit: string;
  binQrCodeValue: string;
  minThreshold: number;
  trackByNumber: boolean;
  purchasePrice: string | null;
  purchaseLink: string | null;
  notes: string | null;
  imageUrl: string | null;
  active: boolean;
  onHand: number;
  availableQuantity: number;
  location: { id: string; name: string };
  categoryRel: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  balances: Array<{ onHandQuantity: number }>;
  units: BulkUnit[];
};
