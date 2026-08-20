import type { QueryClient } from "@tanstack/react-query";

export const signatureCollectionListQueryKeys = [
  ["fetch", "/api/signatures/collections"],
  ["fetch", "/api/signatures/collections?includeArchived=true"],
] as const;

export function signatureCollectionQueryKey(collectionId: string) {
  return ["fetch", `/api/signatures/collections/${collectionId}`] as const;
}

export async function invalidateSignatureCollectionCaches(
  queryClient: QueryClient,
  collectionId: string,
) {
  const queryKeys = [
    signatureCollectionQueryKey(collectionId),
    ...signatureCollectionListQueryKeys,
  ];

  await Promise.all(queryKeys.map((queryKey) => queryClient.invalidateQueries({
    queryKey,
    exact: true,
    refetchType: "none",
  })));
}
