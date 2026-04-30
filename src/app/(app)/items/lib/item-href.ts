export const BULK_ID_PREFIX = "bulk-";

export function isBulkRowId(id: string): boolean {
  return id.startsWith(BULK_ID_PREFIX);
}

export function buildBulkRowId(bulkSkuId: string): string {
  return `${BULK_ID_PREFIX}${bulkSkuId}`;
}

export function getItemHref(id: string): string {
  return isBulkRowId(id)
    ? `/bulk-inventory/${id.slice(BULK_ID_PREFIX.length)}`
    : `/items/${id}`;
}
