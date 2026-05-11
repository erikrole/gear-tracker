"use client";

import { useEffect, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { getQueryClient, getQueryPersistOptions } from "@/lib/query-client";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => getQueryClient());
  const [queryPersistOptions, setQueryPersistOptions] = useState<ReturnType<typeof getQueryPersistOptions>>(null);

  useEffect(() => {
    setQueryPersistOptions(getQueryPersistOptions());
  }, []);

  if (queryPersistOptions) {
    return (
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={queryPersistOptions}
      >
        {children}
      </PersistQueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
