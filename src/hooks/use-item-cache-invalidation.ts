"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function useInvalidateItemCatalog() {
  const queryClient = useQueryClient();

  return useCallback(
    (options: { refetchActive?: boolean } = {}) => {
      const refetchType = options.refetchActive ? "active" : "none";
      void queryClient.invalidateQueries({ queryKey: ["items"], refetchType });
      void queryClient.invalidateQueries({ queryKey: ["form-options"], refetchType: "none" });
    },
    [queryClient]
  );
}
