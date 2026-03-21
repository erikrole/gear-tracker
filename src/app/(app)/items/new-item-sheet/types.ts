import type { CategoryOption } from "@/types/category";

export type Location = { id: string; name: string };
export type Department = { id: string; name: string };

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
