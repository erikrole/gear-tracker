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

/**
 * Format the derived unit QR value for a numbered bulk unit.
 * Mirror of {@link parseDerivedBulkUnitQr}: `{binQrCodeValue}-{unitNumber}`.
 * Never stored — derived at read/export time so the QR data stays single-sourced
 * on `BulkSku.binQrCodeValue` and `BulkSkuUnit.unitNumber` (Decision D-022).
 */
export function buildDerivedBulkUnitQrValue(
  binQrCodeValue: string,
  unitNumber: number,
): string {
  const trimmed = binQrCodeValue.trim();
  if (!trimmed) {
    throw new Error("Cannot derive a unit QR value without a bin QR code");
  }
  if (!Number.isSafeInteger(unitNumber) || unitNumber <= 0) {
    throw new Error(`Invalid unit number for derived QR value: ${unitNumber}`);
  }
  return `${trimmed}-${unitNumber}`;
}

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
