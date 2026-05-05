"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  BulkSkuOption,
  FormUser,
  Location,
} from "@/components/booking-list";

export type FormOptions = {
  locations: Location[];
  departments: Array<{ id: string; name: string }>;
  users: FormUser[];
  bulkSkus: BulkSkuOption[];
};

export function useFormOptions() {
  return useQuery<FormOptions | null>({
    queryKey: ["form-options"],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/form-options", { signal });
      if (!res.ok) throw new Error("Failed to load form options");
      const json = await res.json();
      return (json?.data ?? null) as FormOptions | null;
    },
    staleTime: 5 * 60_000,
    retry: 2,
  });
}
