import type { CategoryOption } from "@/types/category";
import type { Location, Department } from "@/types/common";
export type { Location, Department };

export type ParentSearchResult = {
  id: string;
  assetTag: string;
  name: string | null;
  brand: string;
  model: string;
};

export type ItemKind = "standard" | "units" | "quantity";
export type BulkMode = "new" | "existing";

export interface NewItemSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locations: Location[];
  departments: Department[];
  categories: CategoryOption[];
  onCreated: () => void;
}
