export type BulkQuantitySelection = {
  bulkSkuId: string;
  quantity: number;
};

export type BulkQuantitySku = {
  id: string;
  name: string;
  currentQuantity: number;
  availableQuantity?: number | null;
};

export function getBulkAvailableQuantity(sku: BulkQuantitySku) {
  return Math.max(0, sku.availableQuantity ?? sku.currentQuantity);
}

export function reconcileSelectedBulkQuantities(
  selected: BulkQuantitySelection[],
  skus: BulkQuantitySku[],
) {
  const skuById = new Map(skus.map((sku) => [sku.id, sku]));
  const messages: string[] = [];
  const items: BulkQuantitySelection[] = [];
  let changed = false;

  for (const item of selected) {
    const sku = skuById.get(item.bulkSkuId);
    if (!sku) {
      items.push(item);
      continue;
    }

    const available = getBulkAvailableQuantity(sku);
    if (available <= 0) {
      changed = true;
      messages.push(`${sku.name} was removed because none are available.`);
      continue;
    }

    if (item.quantity > available) {
      changed = true;
      messages.push(`${sku.name} was adjusted from ${item.quantity} to ${available}.`);
      items.push({ ...item, quantity: available });
      continue;
    }

    items.push(item);
  }

  return { changed, items, messages };
}
