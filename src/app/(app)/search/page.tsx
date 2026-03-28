"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { statusBadgeVariant } from "@/lib/status-colors";
import type { BadgeProps } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import EmptyState from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { useUrlState } from "@/hooks/use-url-state";
import { SearchIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type SearchResult = {
  type: "item" | "checkout" | "reservation" | "user";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  status?: string;
};

export default function SearchPage() {
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
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounce query input by 300ms
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query);
      setUrlQuery(query.trim() || "");
    }, 300);
    return () => clearTimeout(t);
  }, [query, setUrlQuery]);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setResults([]);
      setSearched(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setSearched(true);

    const encoded = encodeURIComponent(trimmed);

    try {
      const [itemsRes, checkoutsRes, reservationsRes, usersRes] = await Promise.all([
        fetch(`/api/assets?q=${encoded}&limit=10`, { signal: controller.signal }),
        fetch(`/api/checkouts?q=${encoded}&limit=10`, { signal: controller.signal }),
        fetch(`/api/reservations?q=${encoded}&limit=10`, { signal: controller.signal }),
        fetch(`/api/users?q=${encoded}&limit=10`, { signal: controller.signal }),
      ]);

      const merged: SearchResult[] = [];

      if (itemsRes.ok) {
        const json = await itemsRes.json();
        for (const item of (json.data || []).slice(0, 10)) {
          merged.push({
            type: "item",
            id: item.id,
            title: `${item.assetTag} — ${item.brand} ${item.model}`,
            subtitle: [item.type, item.location?.name].filter(Boolean).join(" · "),
            href: `/items/${item.id}`,
            status: item.computedStatus || item.status,
          });
        }
      }

      if (checkoutsRes.ok) {
        const json = await checkoutsRes.json();
        for (const b of (json.data || []).slice(0, 10)) {
          merged.push({
            type: "checkout",
            id: b.id,
            title: b.title,
            subtitle: b.requester?.name || "",
            href: `/checkouts/${b.id}`,
            status: b.status,
          });
        }
      }

      if (reservationsRes.ok) {
        const json = await reservationsRes.json();
        for (const b of (json.data || []).slice(0, 10)) {
          merged.push({
            type: "reservation",
            id: b.id,
            title: b.title,
            subtitle: b.requester?.name || "",
            href: `/reservations/${b.id}`,
            status: b.status,
          });
        }
      }

      if (usersRes.ok) {
        const json = await usersRes.json();
        for (const u of (json.data || []).slice(0, 10)) {
          merged.push({
            type: "user",
            id: u.id,
            title: u.name,
            subtitle: [u.role, u.email].filter(Boolean).join(" · "),
            href: `/users/${u.id}`,
          });
        }
      }

      if (!controller.signal.aborted) {
        setResults(merged);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (!controller.signal.aborted) {
        setResults([]);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  // Auto-search on debounced query change
  useEffect(() => {
    runSearch(debouncedQuery);
  }, [debouncedQuery, runSearch]);

  const grouped = {
    item: results.filter((r) => r.type === "item"),
    checkout: results.filter((r) => r.type === "checkout"),
    reservation: results.filter((r) => r.type === "reservation"),
    user: results.filter((r) => r.type === "user"),
  };

  const sectionLabels: Record<string, string> = {
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
    <div className="p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-8">
        <h1>Search</h1>
      </div>

      <div className="relative mb-6 max-w-xl">
        <Input
          ref={inputRef}
          type="text"
          className="peer pl-9 pr-9"
          placeholder="Search items, checkouts, reservations, users..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="text-muted-foreground/80 pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 peer-disabled:opacity-50">
          <SearchIcon size={16} />
        </div>
        {query && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="absolute inset-y-0 right-1.5 my-auto text-muted-foreground/80 hover:text-foreground"
            onClick={() => setQuery("")}
            aria-label="Clear search"
          >
            <XIcon size={14} />
          </Button>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-10"><Spinner className="size-8" /></div>
      )}

      {!loading && searched && results.length === 0 && (
        <EmptyState icon="search" title="No results found" description={`Nothing matched "${query}". Try a different search term.`} />
      )}

      {!loading && results.length > 0 && (
        <div className="flex flex-col gap-6">
          {(["item", "checkout", "reservation", "user"] as const).map((type) => {
            const items = grouped[type];
            if (items.length === 0) return null;
            return (
              <div key={type}>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm text-secondary text-uppercase m-0">
                    {sectionLabels[type]} ({items.length}{items.length >= 10 ? "+" : ""})
                  </h2>
                  {items.length >= 10 && (
                    <Link href={sectionViewAllHrefs[type]} className="text-xs text-primary hover:underline">
                      View all {sectionLabels[type].toLowerCase()}
                    </Link>
                  )}
                </div>
                <Card>
                  {items.map((r, i) => (
                    <Link
                      key={r.id}
                      href={r.href}
                      className={`flex items-center justify-between gap-3 py-3 px-4 no-underline text-inherit cursor-pointer hover:bg-accent/50 ${i < items.length - 1 ? "border-b border-border" : ""}`}
                    >
                      <div>
                        <div className="font-semibold">{r.title}</div>
                        {r.subtitle && <div className="text-sm text-secondary">{r.subtitle}</div>}
                      </div>
                      {r.status && (
                        <Badge variant={statusBadgeVariant(r.status) as BadgeProps["variant"]}>
                          {r.status.replace(/_/g, " ")}
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
  );
}
