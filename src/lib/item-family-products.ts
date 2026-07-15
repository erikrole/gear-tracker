export function normalizeItemFamilyProductName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

export function cleanItemFamilyProductText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function cleanOptionalItemFamilyProductText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const cleaned = cleanItemFamilyProductText(value);
  return cleaned || null;
}
