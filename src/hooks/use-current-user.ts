"use client";

import { useQuery } from "@tanstack/react-query";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
};

export function useCurrentUser() {
  return useQuery<CurrentUser | null>({
    queryKey: ["me"],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/me", { signal });
      if (!res.ok) return null;
      const json = await res.json();
      return (json?.user ?? null) as CurrentUser | null;
    },
    staleTime: 5 * 60_000,
  });
}
