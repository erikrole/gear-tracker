"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type SearchResult = {
  type: "item" | "checkout" | "reservation";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  status?: string;
};

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQ);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
      const [itemsRes, checkoutsRes, reservationsRes] = await Promise.all([
        fetch(`/api/assets?q=${encoded}&limit=10`, { signal: controller.signal }),
        fetch(`/api/checkouts?q=${encoded}&limit=10`, { signal: controller.signal }),
        fetch(`/api/reservations?q=${encoded}&limit=10`, { signal: controller.signal }),
      ]);

      const merged: SearchResult[] = [];

      if (itemsRes.ok) {
        const json = await itemsRes.json();
        const items = json.data || [];
        for (const item of items.slice(0, 10)) {
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
        const bookings = json.data || [];
        for (const b of bookings.slice(0, 10)) {
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
        const bookings = json.data || [];
        for (const b of bookings.slice(0, 10)) {
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

  // Auto-search from URL param on mount
  useEffect(() => {
    if (initialQ) runSearch(initialQ);
  }, [initialQ, runSearch]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    router.replace(`/search?q=${encodeURIComponent(trimmed)}`, { scroll: false });
    runSearch(trimmed);
  }

  const grouped = {
    item: results.filter((r) => r.type === "item"),
    checkout: results.filter((r) => r.type === "checkout"),
    reservation: results.filter((r) => r.type === "reservation"),
  };

  const sectionLabels: Record<string, string> = {
    item: "Items",
    checkout: "Checkouts",
    reservation: "Reservations",
  };

  return (
    <div className="p-24">
      <h1 className="m-0 mb-16">Search</h1>

      <form onSubmit={handleSubmit} className="mb-24">
        <div className="flex gap-8">
          <input
            ref={inputRef}
            type="text"
            className="form-input flex-1"
            placeholder="Search items, checkouts, reservations..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </button>
        </div>
      </form>

      {loading && (
        <div className="loading-spinner"><div className="spinner" /></div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="empty-state">No results found for "{query}"</div>
      )}

      {!loading && results.length > 0 && (
        <div className="flex-col gap-24">
          {(["item", "checkout", "reservation"] as const).map((type) => {
            const items = grouped[type];
            if (items.length === 0) return null;
            return (
              <div key={type}>
                <h2 className="text-sm text-secondary text-uppercase font-semibold mb-8 m-0">
                  {sectionLabels[type]} ({items.length})
                </h2>
                <div className="card">
                  {items.map((r, i) => (
                    <Link
                      key={r.id}
                      href={r.href}
                      className="search-result-row"
                      style={i < items.length - 1 ? { borderBottom: "1px solid var(--border-light)" } : undefined}
                    >
                      <div>
                        <div className="font-semibold">{r.title}</div>
                        {r.subtitle && <div className="text-sm text-secondary">{r.subtitle}</div>}
                      </div>
                      {r.status && (
                        <span className={`badge badge-sm badge-${statusColor(r.status)}`}>
                          {r.status.replace(/_/g, " ")}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function statusColor(status: string): string {
  switch (status) {
    case "AVAILABLE": return "green";
    case "OPEN": case "BOOKED": return "blue";
    case "CHECKED_OUT": return "blue";
    case "RESERVED": return "purple";
    case "MAINTENANCE": return "orange";
    case "COMPLETED": return "gray";
    case "CANCELLED": return "gray";
    case "OVERDUE": return "red";
    case "RETIRED": return "gray";
    default: return "gray";
  }
}
