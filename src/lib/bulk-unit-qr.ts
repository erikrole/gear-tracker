export type DerivedBulkUnitQrSku = {
  id: string;
  binQrCodeValue: string | null;
  trackByNumber?: boolean | null;
};

export type DerivedBulkUnitQrMatch = {
  bulkSkuId: string;
  binQrCodeValue: string;
  unitNumber: number;
};

export function parseDerivedBulkUnitQr(
  scanValue: string,
  skus: DerivedBulkUnitQrSku[],
): DerivedBulkUnitQrMatch | null {
  const rawValue = scanValue.trim();
  if (!rawValue) return null;

  const normalizedValue = rawValue.toLowerCase();
  const candidates = skus
    .filter((sku) => sku.trackByNumber && sku.binQrCodeValue?.trim())
    .map((sku) => ({
      id: sku.id,
      binQrCodeValue: sku.binQrCodeValue!.trim(),
    }))
    .sort((a, b) => b.binQrCodeValue.length - a.binQrCodeValue.length);

  for (const sku of candidates) {
    const prefix = `${sku.binQrCodeValue.toLowerCase()}-`;
    if (!normalizedValue.startsWith(prefix)) continue;

    const suffix = rawValue.slice(sku.binQrCodeValue.length + 1).trim();
    if (!/^\d+$/.test(suffix)) return null;

    const unitNumber = Number(suffix);
    if (!Number.isSafeInteger(unitNumber) || unitNumber <= 0) return null;

    return {
      bulkSkuId: sku.id,
      binQrCodeValue: sku.binQrCodeValue,
      unitNumber,
    };
  }

  return null;
}
