"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { getQueryClient, getQueryPersistOptions } from "@/lib/query-client";

const AuthenticatedQueryUserContext = createContext<string | null>(null);

export function useAuthenticatedQueryUserId() {
  return useContext(AuthenticatedQueryUserContext);
}

export function QueryProvider({
  children,
  userId,
}: {
  children: React.ReactNode;
  userId: string;
}) {
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
        <AuthenticatedQueryUserContext.Provider value={userId}>
          {children}
        </AuthenticatedQueryUserContext.Provider>
      </PersistQueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthenticatedQueryUserContext.Provider value={userId}>
        {children}
      </AuthenticatedQueryUserContext.Provider>
    </QueryClientProvider>
  );
}
