"use client";

import { useQuery } from "@tanstack/react-query";
import { parseJsonSafely } from "@/lib/errors";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  affiliation?: string | null;
  collaboratorProfile?: string | null;
  collaboratorPolicy?: {
    id: string;
    affiliationKey: string;
    displayName: string;
    badgeLabel: string;
    status: "ACTIVE" | "SUSPENDED";
    version: number;
  } | null;
  capabilities?: string[];
  avatarUrl?: string | null;
  forcePasswordChange?: boolean;
};

export function useCurrentUser(initialUser?: CurrentUser) {
  return useQuery<CurrentUser | null>({
    queryKey: ["me"],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/me", { signal });
      if (!res.ok) return null;
      const json = await parseJsonSafely<{ user?: CurrentUser | null }>(res);
      return (json?.user ?? null) as CurrentUser | null;
    },
    initialData: initialUser ?? undefined,
    staleTime: 5 * 60_000,
  });
}
