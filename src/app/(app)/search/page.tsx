"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { statusBadgeVariant } from "@/lib/status-colors";
import type { BadgeProps } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import EmptyState from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { useUrlState } from "@/hooks/use-url-state";
import { AlertCircleIcon, ArrowRightIcon, SearchIcon, WifiOff, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OperationalPartialResultsAlert } from "@/components/OperationalFeedback";
import { PageHeader } from "@/components/PageHeader";
import { FadeUp } from "@/components/ui/motion";
import { useCurrentUser } from "@/hooks/use-current-user";
import { handleAuthRedirect, parseJsonSafely } from "@/lib/errors";
import { getVisiblePageSearchResults, type PageSearchResult } from "@/lib/search-pages";
import { assetSearchTitle } from "@/lib/search-result-title";

type EntitySearchResult = {
  type: "item" | "checkout" | "reservation" | "user";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  status?: string;
};

type SearchResult = EntitySearchResult | PageSearchResult;

type ApiSearchList<T> = {
  data?: T[];
};

type AssetSearchItem = {
  id: string;
  assetTag?: string | null;
  name?: string | null;
  brand?: string | null;
  model?: string | null;
  type?: string | null;
  location?: { name?: string | null } | null;
  computedStatus?: string | null;
  status?: string | null;
};

type BookingSearchItem = {
  id: string;
  title?: string | null;
  requester?: { name?: string | null } | null;
  status?: string | null;
};

type UserSearchItem = {
  id: string;
  name?: string | null;
  role?: string | null;
  email?: string | null;
};

const SEARCH_RESULT_SOURCES = {
  items: "Items",
  checkouts: "Checkouts",
  reservations: "Reservations",
  users: "Users",
} as const;

function formatStatusLabel(status: string): string {
  switch (status) {
    case "PENDING_PICKUP": return "Awaiting pickup";
    case "OPEN": return "Checked Out";
    case "BOOKED": return "Reserved";
    case "DRAFT": return "Draft";
    case "COMPLETED": return "Completed";
    case "CANCELLED": return "Cancelled";
    default: return status.replace(/_/g, " ");
  }
}

export default function SearchPage() {
  const { data: user } = useCurrentUser();
  const [urlQuery, setUrlQuery] = useUrlState<string>(
    "q",
    (v) => v ?? "",
    (v) => (v ? v : null),
  );
  const [query, setQuery] = useState(urlQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(urlQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState<"network" | "server" | false>(false);
  const [partialFailures, setPartialFailures] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const resetSearchState = useCallback(() => {
    abortRef.current?.abort();
    setResults([]);
    setLoading(false);
    setSearched(false);
    setSearchError(false);
    setPartialFailures([]);
  }, []);

  useEffect(() => {
    setQuery((current) => (current === urlQuery ? current : urlQuery));
    setDebouncedQuery((current) => (current === urlQuery ? current : urlQuery));
    if (!urlQuery.trim()) resetSearchState();
  }, [resetSearchState, urlQuery]);

  // Debounce query input by 300ms
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query);
      setUrlQuery(query.trim() || "");
    }, 300);
    return () => clearTimeout(t);
  }, [query, setUrlQuery]);

  // NOTE (GAP-11): This page intentionally uses raw fetch() instead of useFetch.
  // The search fans out to 4 endpoints in parallel (assets, checkouts, reservations,
  // users) with a shared AbortController, then merges results into a unified list.
  // useFetch is single-URL and doesn't support coordinated multi-endpoint abort/merge.
  // Caching is also undesirable here — search results should always be fresh for the
  // current query string.
  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      resetSearchState();
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setSearched(true);
    setSearchError(false as const);
    setPartialFailures([]);

    const encoded = encodeURIComponent(trimmed);

    try {
      const [itemsRes, checkoutsRes, reservationsRes, usersRes] = await Promise.allSettled([
        fetch(`/api/assets?q=${encoded}&limit=10`, { signal: controller.signal }),
        fetch(`/api/checkouts?q=${encoded}&status_in=OPEN,PENDING_PICKUP&limit=10`, { signal: controller.signal }),
        fetch(`/api/reservations?q=${encoded}&status=BOOKED&limit=10`, { signal: controller.signal }),
        fetch(`/api/users?q=${encoded}&limit=10`, { signal: controller.signal }),
      ]);

      const merged: SearchResult[] = getVisiblePageSearchResults(user?.role, trimmed, 12);
      const failures: string[] = [];

      if (itemsRes.status === "fulfilled" && handleAuthRedirect(itemsRes.value, "/search")) return;
      if (checkoutsRes.status === "fulfilled" && handleAuthRedirect(checkoutsRes.value, "/search")) return;
      if (reservationsRes.status === "fulfilled" && handleAuthRedirect(reservationsRes.value, "/search")) return;
      if (usersRes.status === "fulfilled" && handleAuthRedirect(usersRes.value, "/search")) return;

      if (itemsRes.status === "fulfilled" && itemsRes.value.ok) {
        const json = await parseJsonSafely<ApiSearchList<AssetSearchItem>>(itemsRes.value);
        const data = json?.data;
        if (!data) failures.push(SEARCH_RESULT_SOURCES.items);
        for (const item of (data ?? []).slice(0, 10)) {
          merged.push({
            type: "item",
            id: item.id,
            title: assetSearchTitle(item),
            subtitle: [item.type, item.location?.name].filter(Boolean).join(" · "),
            href: `/items/${item.id}`,
            status: item.computedStatus || item.status || undefined,
          });
        }
      } else {
        failures.push(SEARCH_RESULT_SOURCES.items);
      }

      if (checkoutsRes.status === "fulfilled" && checkoutsRes.value.ok) {
        const json = await parseJsonSafely<ApiSearchList<BookingSearchItem>>(checkoutsRes.value);
        const data = json?.data;
        if (!data) failures.push(SEARCH_RESULT_SOURCES.checkouts);
        for (const b of (data ?? []).slice(0, 10)) {
          merged.push({
            type: "checkout",
            id: b.id,
            title: b.title ?? "Untitled checkout",
            subtitle: b.requester?.name || "",
            href: `/checkouts/${b.id}`,
            status: b.status ?? undefined,
          });
        }
      } else {
        failures.push(SEARCH_RESULT_SOURCES.checkouts);
      }

      if (reservationsRes.status === "fulfilled" && reservationsRes.value.ok) {
        const json = await parseJsonSafely<ApiSearchList<BookingSearchItem>>(reservationsRes.value);
        const data = json?.data;
        if (!data) failures.push(SEARCH_RESULT_SOURCES.reservations);
        for (const b of (data ?? []).slice(0, 10)) {
          merged.push({
            type: "reservation",
            id: b.id,
            title: b.title ?? "Untitled reservation",
            subtitle: b.requester?.name || "",
            href: `/reservations/${b.id}`,
            status: b.status ?? undefined,
          });
        }
      } else {
        failures.push(SEARCH_RESULT_SOURCES.reservations);
      }

      if (usersRes.status === "fulfilled" && usersRes.value.ok) {
        const json = await parseJsonSafely<ApiSearchList<UserSearchItem>>(usersRes.value);
        const data = json?.data;
        if (!data) failures.push(SEARCH_RESULT_SOURCES.users);
        for (const u of (data ?? []).slice(0, 10)) {
          merged.push({
            type: "user",
            id: u.id,
            title: u.name ?? "Unnamed user",
            subtitle: [u.role, u.email].filter(Boolean).join(" · "),
            href: `/users/${u.id}`,
          });
        }
      } else {
        failures.push(SEARCH_RESULT_SOURCES.users);
      }

      if (!controller.signal.aborted) {
        if (failures.length === 4 && merged.length === 0) {
          setSearchError("server");
        } else {
          setResults(merged);
          setPartialFailures(failures);
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (!controller.signal.aborted) {
        setResults([]);
        setSearchError("network");
        setPartialFailures([]);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [resetSearchState, user?.role]);

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    if (!value.trim()) {
      setDebouncedQuery("");
      setUrlQuery("");
      resetSearchState();
    }
  }, [resetSearchState, setUrlQuery]);

  // Auto-search on debounced query change
  useEffect(() => {
    runSearch(debouncedQuery);
  }, [debouncedQuery, runSearch]);

  const grouped = {
    page: results.filter((r) => r.type === "page"),
    item: results.filter((r) => r.type === "item"),
    checkout: results.filter((r) => r.type === "checkout"),
    reservation: results.filter((r) => r.type === "reservation"),
    user: results.filter((r) => r.type === "user"),
  };

  const sectionLabels: Record<string, string> = {
    page: "Go to",
    item: "Items",
    checkout: "Checkouts",
    reservation: "Reservations",
    user: "Users",
  };

  const sectionViewAllHrefs: Record<string, string> = {
    item: `/items?q=${encodeURIComponent(query.trim())}`,
    checkout: `/bookings?tab=checkouts&q=${encodeURIComponent(query.trim())}`,
    reservation: `/bookings?tab=reservations&q=${encodeURIComponent(query.trim())}`,
    user: `/users?q=${encodeURIComponent(query.trim())}`,
  };

  return (
    <FadeUp>
    <div className="p-6">
      <PageHeader title="Search" />

      <div className="relative mb-6 max-w-xl">
        <Input
          id="global-search-query"
          name="global-search-query"
          ref={inputRef}
          type="text"
          className="peer h-10 pl-9 pr-11"
          placeholder="Search items, checkouts, reservations, users..."
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          aria-label="Search items, checkouts, reservations, users"
        />
        <div className="text-muted-foreground/80 pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 peer-disabled:opacity-50">
          <SearchIcon size={16} />
        </div>
        {query && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute inset-y-0 right-0.5 my-auto size-10 text-muted-foreground/80 hover:text-foreground"
            onClick={() => handleQueryChange("")}
            aria-label="Clear search"
          >
            <XIcon size={14} />
          </Button>
        )}
      </div>

      {loading && (
        <div className="flex flex-col gap-6" role="status" aria-label="Loading search results">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-3.5 w-20 mb-2" />
              <Card>
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className={`flex items-center justify-between gap-3 py-3 px-4 ${j < 2 ? "border-b border-border" : ""}`}>
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-[60%]" />
                      <Skeleton className="h-3 w-[35%]" />
                    </div>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                ))}
              </Card>
            </div>
          ))}
        </div>
      )}

      {!loading && searchError && query.trim() && (
        <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          {searchError === "network"
            ? <WifiOff className="size-8 opacity-40" />
            : <AlertCircleIcon className="size-8 opacity-40" />}
          <p className="text-sm">
            {searchError === "network"
              ? "Can\u2019t connect \u2014 check your connection and try again."
              : "Search failed \u2014 something went wrong on our end. Try again."}
          </p>
        </div>
      )}

      {!loading && !searchError && partialFailures.length > 0 && results.length > 0 && (
        <OperationalPartialResultsAlert
          className="mb-4"
          failureLabel="Unavailable result types"
          failures={partialFailures}
          noun="result type"
          recoveryCopy="Showing available matches. Refresh before treating this search as complete."
          title="Some result types did not load"
        />
      )}

      {!loading && !searchError && searched && results.length === 0 && (
        <EmptyState icon="search" title="No results found" description={`Nothing matched "${query}". Try a tag, borrower, page name, setting, or report.`} />
      )}

      {!loading && results.length > 0 && (
        <div className="flex flex-col gap-6">
          {(["page", "item", "checkout", "reservation", "user"] as const).map((type) => {
            const items = grouped[type];
            if (items.length === 0) return null;
            return (
              <div key={type}>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm text-muted-foreground uppercase m-0">
                    {sectionLabels[type]!} ({items.length}{items.length >= 10 ? "+" : ""})
                  </h2>
                  {type !== "page" && items.length >= 10 && (
                    <Link
                      href={sectionViewAllHrefs[type]!}
                      className="inline-flex min-h-10 items-center rounded-md px-2 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      View all {sectionLabels[type]!.toLowerCase()}
                    </Link>
                  )}
                </div>
                <Card>
                  {items.map((r, i) => (
                    <Link
                      key={r.id}
                      href={r.href}
                      className={`flex min-h-12 items-center justify-between gap-3 py-3 px-4 no-underline text-inherit cursor-pointer hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 ${i < items.length - 1 ? "border-b border-border" : ""}`}
                    >
                      <div>
                        <div className="flex items-center gap-2 font-semibold">
                          {r.type === "page" && <ArrowRightIcon className="size-4 text-muted-foreground" aria-hidden="true" />}
                          <span>{r.title}</span>
                        </div>
                        {r.subtitle && <div className="text-sm text-muted-foreground">{r.subtitle}</div>}
                      </div>
                      {r.type !== "page" && r.status && (
                        <Badge variant={statusBadgeVariant(r.status) as BadgeProps["variant"]}>
                          {formatStatusLabel(r.status)}
                        </Badge>
                      )}
                    </Link>
                  ))}
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
    </FadeUp>
  );
}
