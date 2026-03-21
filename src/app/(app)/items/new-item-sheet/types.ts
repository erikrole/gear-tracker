export type CategoryOption = { id: string; name: string; parentId: string | null };
export type Location = { id: string; name: string };
export type Department = { id: string; name: string };

export type BulkSkuOption = {
  id: string;
  name: string;
  location: { name: string };
  balances: { onHandQuantity: number }[];
  categoryRel: { name: string } | null;
};

export type ParentSearchResult = {
  id: string;
  assetTag: string;
  name: string | null;
  brand: string;
  model: string;
};

export type ItemKind = "serialized" | "bulk";
export type BulkMode = "new" | "existing";

export interface NewItemSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locations: Location[];
  departments: Department[];
  categories: CategoryOption[];
  onCreated: () => void;
}
