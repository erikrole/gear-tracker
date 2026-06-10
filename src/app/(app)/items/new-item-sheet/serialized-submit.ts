export const UNKNOWN_ITEM_METADATA = "Unknown";

export type SerializedSubmitInput = {
  assetTag: string;
  itemName: string;
  brand: string;
  model: string;
  serialNumber: string;
  qrCodeValue: string;
  locationId: string;
  categoryId: string;
  departmentId: string;
  purchaseDate: string;
  purchasePrice: string;
  warrantyDate: string;
  residualValue: string;
  linkUrl: string;
  uwAssetTag: string;
  fiscalYear: string;
  userNotes: string;
  availableForReservation: boolean;
  availableForCheckout: boolean;
  availableForCustody: boolean;
  isAccessory: boolean;
  parentAssetId?: string;
};

function trimmed(value: string) {
  return value.trim();
}

export function buildSerializedItemSubmitBody(input: SerializedSubmitInput): Record<string, unknown> {
  const metadata: Record<string, string> = {};
  if (input.fiscalYear) metadata.fiscalYear = input.fiscalYear;
  if (trimmed(input.userNotes)) metadata.userNotes = trimmed(input.userNotes);

  return {
    assetTag: trimmed(input.assetTag),
    type: "equipment",
    brand: trimmed(input.brand) || UNKNOWN_ITEM_METADATA,
    model: trimmed(input.model) || UNKNOWN_ITEM_METADATA,
    qrCodeValue: trimmed(input.qrCodeValue),
    locationId: input.locationId,
    availableForReservation: input.isAccessory ? false : input.availableForReservation,
    availableForCheckout: input.isAccessory ? false : input.availableForCheckout,
    availableForCustody: input.isAccessory ? false : input.availableForCustody,
    ...(input.isAccessory && input.parentAssetId ? { parentAssetId: input.parentAssetId } : {}),
    ...(trimmed(input.serialNumber) ? { serialNumber: trimmed(input.serialNumber) } : {}),
    ...(input.categoryId ? { categoryId: input.categoryId } : {}),
    ...(input.departmentId ? { departmentId: input.departmentId } : {}),
    ...(trimmed(input.itemName) ? { name: trimmed(input.itemName) } : {}),
    ...(input.purchaseDate ? { purchaseDate: input.purchaseDate } : {}),
    ...(input.purchasePrice ? { purchasePrice: parseFloat(input.purchasePrice) } : {}),
    ...(input.warrantyDate ? { warrantyDate: input.warrantyDate } : {}),
    ...(input.residualValue ? { residualValue: parseFloat(input.residualValue) } : {}),
    ...(trimmed(input.linkUrl) ? { linkUrl: trimmed(input.linkUrl) } : {}),
    ...(trimmed(input.uwAssetTag) ? { uwAssetTag: trimmed(input.uwAssetTag) } : {}),
    ...(Object.keys(metadata).length ? { notes: JSON.stringify(metadata) } : {}),
  };
}
