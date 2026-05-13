const BATTERY_TERMS = [
  "battery",
  "batteries",
  "np-fz100",
  "npfz100",
  "fz100",
  "bp-u",
  "bpu",
  "lp-e6",
  "lpe6",
  "v-mount",
  "vmount",
  "gold mount",
];

const BATTERY_TERM_PATTERNS = BATTERY_TERMS.map((term) =>
  new RegExp(`(^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`, "i"),
);

export function isBatterySku(sku: {
  name: string;
  category?: string | null;
  categoryRel?: { name: string } | null;
}) {
  const text = [sku.name, sku.category ?? "", sku.categoryRel?.name ?? ""].join(" ").toLowerCase();
  return BATTERY_TERM_PATTERNS.some((pattern) => pattern.test(text));
}
