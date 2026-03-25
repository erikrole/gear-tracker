"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

type BreadcrumbContextValue = {
  label: string | null;
  setBreadcrumbLabel: (label: string | null) => void;
};

const BreadcrumbContext = createContext<BreadcrumbContextValue>({
  label: null,
  setBreadcrumbLabel: () => {},
});

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [label, setLabel] = useState<string | null>(null);
  const setBreadcrumbLabel = useCallback((l: string | null) => setLabel(l), []);

  return (
    <BreadcrumbContext.Provider value={{ label, setBreadcrumbLabel }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumbLabel() {
  return useContext(BreadcrumbContext);
}
