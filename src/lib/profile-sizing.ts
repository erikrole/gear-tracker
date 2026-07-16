export const TOP_SIZE_OPTIONS = ["XXS", "XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"] as const;

function halfSizes(start: number, end: number): string[] {
  const values: string[] = [];
  for (let value = start * 2; value <= end * 2; value += 1) {
    values.push(value % 2 === 0 ? String(value / 2) : (value / 2).toFixed(1));
  }
  return values;
}

export const WOMENS_SHOE_SIZE_OPTIONS = halfSizes(5, 16);
export const MENS_SHOE_SIZE_OPTIONS = halfSizes(4, 18);

export const APPAREL_FIT_OPTIONS = [
  { value: "UNISEX", label: "Unisex" },
  { value: "WOMENS", label: "Women’s" },
  { value: "MENS", label: "Men’s" },
] as const;

export const SHOE_SYSTEM_OPTIONS = [
  { value: "US_WOMENS", label: "Women’s" },
  { value: "US_MENS", label: "Men’s" },
] as const;
