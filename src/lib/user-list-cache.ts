import type { QueryClient, QueryKey } from "@tanstack/react-query";

type CachedUserRow = {
  id: string;
  [key: string]: unknown;
};

type CachedUserList = {
  data?: CachedUserRow[];
  [key: string]: unknown;
};

const ROSTER_FIELDS = new Set([
  "name",
  "email",
  "role",
  "staffingType",
  "primaryArea",
  "locationId",
  "location",
  "avatarUrl",
  "active",
  "hiddenFromRoster",
  "title",
  "gradYear",
  "studentYearOverride",
]);

export function isUsersListQueryKey(queryKey: QueryKey): boolean {
  return queryKey[0] === "fetch" &&
    typeof queryKey[1] === "string" &&
    queryKey[1].startsWith("/api/users?");
}

function rosterPatch(values: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(values).filter(([key]) => ROSTER_FIELDS.has(key)),
  );
}

/**
 * Keep every cached Users filter/page coherent after a confirmed profile save.
 * Rows update immediately, while invalidation makes the next mounted roster
 * verify membership, counts, and sorting against the server.
 */
export async function syncCachedUserLists(
  queryClient: QueryClient,
  userId: string,
  values: Record<string, unknown>,
): Promise<void> {
  const patch = rosterPatch(values);
  if (Object.keys(patch).length > 0) {
    queryClient.setQueriesData<CachedUserList>(
      { predicate: (query) => isUsersListQueryKey(query.queryKey) },
      (previous) => {
        if (!previous || !Array.isArray(previous.data)) return previous;
        let changed = false;
        const data = previous.data.map((row) => {
          if (row.id !== userId) return row;
          changed = true;
          return { ...row, ...patch };
        });
        return changed ? { ...previous, data } : previous;
      },
    );
  }

  await queryClient.invalidateQueries({
    predicate: (query) => isUsersListQueryKey(query.queryKey),
    refetchType: "none",
  });
}
