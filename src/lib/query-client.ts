import { QueryClient } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      // 24h — keeps persisted cache useful across sessions
      gcTime: 24 * 60 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});

// Persist selected queries to localStorage so returning users see instant content
// instead of a skeleton on every visit. Only dashboard + booking-detail are
// persisted — list/settings queries are cheap enough to refetch.
if (typeof window !== "undefined") {
  const persister = createSyncStoragePersister({
    storage: window.localStorage,
    key: "gear-tracker:query-cache",
    throttleTime: 1_000, // write at most once per second
  });

  persistQueryClient({
    queryClient,
    persister,
    maxAge: 24 * 60 * 60_000,
    dehydrateOptions: {
      shouldDehydrateQuery: (query) => {
        const key = query.queryKey[0];
        return key === "dashboard" || key === "booking";
      },
    },
  });
}
