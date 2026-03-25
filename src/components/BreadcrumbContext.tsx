"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";

type BreadcrumbContextValue = {
  label: string | null;
  setBreadcrumbLabel: (label: string | null) => void;
};

const BreadcrumbContext = createContext<BreadcrumbContextValue>({
  label: null,
  setBreadcrumbLabel: () => {},
});

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [label, setLabel] = useState<string | null>(null);
  const setBreadcrumbLabel = useCallback((l: string | null) => setLabel(l), []);

  // Reset label on navigation instead of remounting the tree via key={pathname}
  useEffect(() => { setLabel(null); }, [pathname]);

  return (
    <BreadcrumbContext.Provider value={{ label, setBreadcrumbLabel }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumbLabel() {
  return useContext(BreadcrumbContext);
}
