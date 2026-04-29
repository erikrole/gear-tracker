"use client";

import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
const BookingDetailsSheet = lazy(() => import("@/components/BookingDetailsSheet"));
import { toast } from "sonner";
import { SkeletonTable } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { handleAuthRedirect, parseErrorMessage } from "@/lib/errors";

import {
  SortHeader,
  BookingFilters,
  BookingTableRow,
  BookingMobileCard,
  BookingCard,
  type BookingItem,
  type BookingListConfig,
  type StatusOption,
  type ContextMenuExtra,
  type FormUser,
  type Location,
  type ListResponse,
} from "./booking-list";

/* ───── Re-exports for backward compatibility ───── */
export type { BookingItem, BookingListConfig, StatusOption, ContextMenuExtra };

/* ───── Component ───── */

export default function BookingListPage({ config, viewMode = "table", hideHeader = false, hideNewButton = false, initialHighlight }: { config: BookingListConfig; viewMode?: "table" | "cards"; hideHeader?: boolean; hideNewButton?: boolean; initialHighlight?: string | null }) {
  const urlParams = useSearchParams();
  const router = useRouter();

  // ── Filter state ──
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("");
  const [statusFilter, setStatusFilter] = useState(urlParams.get("status") || config.defaultStatusFilter || "");
  const [sportFilter, setSportFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [specialFilter, setSpecialFilter] = useState(urlParams.get("filter") || "");

  // ── List data (React Query) ──
  const queryClient = useQueryClient();
  const limit = 20;
  const listUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(page * limit));
    if (search) params.set("q", search);
    if (sort) params.set("sort", sort);
    if (specialFilter) params.set("filter", specialFilter);
    if (!specialFilter && statusFilter) params.set("status", statusFilter);
    if (config.hasSportFilter && sportFilter) params.set("sport_code", sportFilter);
    if (locationFilter) params.set("location_id", locationFilter);
    if (userFilter) params.set("requester_id", userFilter);
    return `${config.apiBase}?${params}`;
  }, [page, search, sort, statusFilter, sportFilter, locationFilter, userFilter, specialFilter, config.apiBase, config.hasSportFilter]);

  const { data: listData, isLoading: loading, isFetching, isError, refetch } = useQuery<ListResponse>({
    queryKey: ["bookingList", config.kind, listUrl],
    queryFn: async ({ signal }) => {
      const res = await fetch(listUrl, { signal });
      if (handleAuthRedirect(res)) throw new DOMException("Auth redirect", "AbortError");
      if (!res.ok) throw new Error("server");
      return res.json();
    },
    refetchOnWindowFocus: true,
  });
  const reload = async () => { await refetch(); };
  const items = listData?.data ?? [];
  const total = listData?.total ?? 0;

  // On background refresh failure (cached data still visible): toast instead of replacing UI
  const prevIsErrorRef = useRef(false);
  useEffect(() => {
    if (isError && !prevIsErrorRef.current && listData) {
      toast.error(typeof navigator !== "undefined" && !navigator.onLine
        ? "You're offline — showing cached data"
        : `Couldn't refresh — showing cached data`);
    }
    prevIsErrorRef.current = isError;
  }, [isError]); // eslint-disable-line react-hooks/exhaustive-deps

  // Only show error screen on initial load (no cached data to fall back on)
  const loadError: false | "network" | "server" = isError && !listData
    ? (typeof navigator !== "undefined" && !navigator.onLine ? "network" : "server")
    : false;

  /** Optimistic update helper — mutates the cached list data */
  const setItems = (updater: BookingItem[] | ((prev: BookingItem[]) => BookingItem[])) => {
    queryClient.setQueryData<ListResponse>(["bookingList", config.kind, listUrl], (prev) => {
      if (!prev) return prev;
      const newItems = typeof updater === "function" ? updater(prev.data ?? []) : updater;
      return { ...prev, data: newItems };
    });
  };

  // ── Form options (React Query, shared cache) ──
  const { data: formOpts } = useQuery({
    queryKey: ["form-options"],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/form-options", { signal });
      if (!res.ok) return null;
      const json = await res.json();
      return json?.data ?? null;
    },
    staleTime: 5 * 60_000,
  });
  const users: FormUser[] = formOpts?.users ?? [];
  const locations: Location[] = formOpts?.locations ?? [];

  // ── Current user (React Query, shared cache) ──
  const { data: meData } = useQuery({
    queryKey: ["me"],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/me", { signal });
      if (!res.ok) return null;
      const json = await res.json();
      return json?.user ?? null;
    },
    staleTime: 5 * 60_000,
  });
  const currentUserId = meData?.id ?? "";
  const currentUserRole = meData?.role ?? "";
  // initialRequester is now handled inside the wizard page

  // Apply "mine" filter from URL once user data loads
  useEffect(() => {
    if (urlParams.get("mine") === "true" && meData?.id && !userFilter) {
      setUserFilter(meData.id);
    }
  }, [meData?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Navigate to wizard page for creation ──
  function navigateToCreate() {
    const base = config.kind === "CHECKOUT" ? "/checkouts/new" : "/reservations/new";
    const params = new URLSearchParams();
    const title = urlParams.get("title");
    const startsAt = urlParams.get("startsAt");
    const endsAt = urlParams.get("endsAt");
    const locationId = urlParams.get("locationId");
    const newFor = urlParams.get("newFor");
    const eventId = urlParams.get("eventId");
    const sportCode = urlParams.get("sportCode");
    const draftId = urlParams.get("draftId");
    if (title) params.set("title", title);
    if (startsAt) params.set("startsAt", startsAt);
    if (endsAt) params.set("endsAt", endsAt);
    if (locationId) params.set("locationId", locationId);
    if (newFor) params.set("newFor", newFor);
    if (eventId) params.set("eventId", eventId);
    if (sportCode) params.set("sportCode", sportCode);
    if (draftId) params.set("draftId", draftId);
    const qs = params.toString();
    router.push(qs ? `${base}?${qs}` : base);
  }

  // Auto-navigate to wizard if deep-link params present
  useEffect(() => {
    if (urlParams.get("create") === "true" || urlParams.get("title") || urlParams.get("draftId") || urlParams.get("newFor")) {
      navigateToCreate();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sheet + menu ──
  // initialHighlight prop takes precedence over URL param (avoids multi-tab race when all tabs mount simultaneously)
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(
    initialHighlight !== undefined ? (initialHighlight || null) : (urlParams.get("highlight") || null)
  );
  const [initialSheetTab, setInitialSheetTab] = useState<string | null>(urlParams.get("sheetTab") || null);

  // Clear highlight/sheetTab from URL after consuming them (only when using URL-based highlight for deep links)
  useEffect(() => {
    if (initialHighlight === undefined && (urlParams.get("highlight") || urlParams.get("sheetTab"))) {
      const next = new URLSearchParams(urlParams.toString());
      next.delete("highlight");
      next.delete("sheetTab");
      const qs = next.toString();
      router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [extendingId, setExtendingId] = useState<string | null>(null);
  const extendingRef = useRef(false);

  // ── Overdue-first sort: float overdue items to top of current page ──
  const sortedItems = useMemo(() => {
    if (!config.overdueStatus) return items;
    const now = new Date();
    return [...items].sort((a, b) => {
      const aOverdue = a.status === config.overdueStatus && new Date(a.endsAt) < now;
      const bOverdue = b.status === config.overdueStatus && new Date(b.endsAt) < now;
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;
      // Within overdue group: longest overdue first
      if (aOverdue && bOverdue) return new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime();
      return 0;
    });
  }, [items, config.overdueStatus]);

  // ── Data fetching is handled by React Query above ──

  // ── Menu handlers ──

  async function handleExtendFromMenu(bookingId: string, days: number) {
    const item = items.find((i) => i.id === bookingId);
    if (!item || extendingId || extendingRef.current) return;
    extendingRef.current = true;
    setExtendingId(bookingId);
    try {
      const res = await fetchWithTimeout(`/api/bookings/${bookingId}/extend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endsAt: new Date(new Date(item.endsAt).getTime() + days * 24 * 60 * 60 * 1000).toISOString() }),
      });
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        toast.success(`Extended by ${days} day${days !== 1 ? "s" : ""}`);
      } else {
        const msg = await parseErrorMessage(res, "Extend failed");
        toast.error(msg);
      }
      await reload();
    } catch {
      toast.error("Network error \u2014 please try again.");
    }
    extendingRef.current = false;
    setExtendingId(null);
  }

  // (Create flow is now a separate page — no sheet callbacks needed)

  // ── Derived ──

  const totalPages = Math.ceil(total / limit);

  const sportCodesInUse = useMemo(() => {
    if (!config.hasSportFilter) return [];
    const codes = new Set<string>();
    for (const item of items) {
      if (item.sportCode) codes.add(item.sportCode);
    }
    return Array.from(codes).sort();
  }, [items, config.hasSportFilter]);

  return (
    <>
      {!hideHeader && (
        <div className="flex items-center justify-between mb-6 max-md:mb-4 max-md:flex-col max-md:items-start max-md:gap-3">
          <h1 className="text-[30px] tracking-[-0.03em] leading-none m-0 max-md:text-[22px]">{config.labelPlural}</h1>
          <Button onClick={navigateToCreate}>
            New {config.label}
          </Button>
        </div>
      )}
      {hideHeader && !hideNewButton && (
        <div className="flex justify-end px-4 pt-3">
          <Button onClick={navigateToCreate}>
            New {config.label}
          </Button>
        </div>
      )}

      {/* ════════ Filter bar + list ════════ */}
      <Card>
        <BookingFilters
          config={config}
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(0); }}
          statusFilter={statusFilter}
          onStatusFilterChange={(v) => { setStatusFilter(v); setPage(0); }}
          specialFilter={specialFilter}
          onSpecialFilterChange={(v) => { setSpecialFilter(v); setPage(0); }}
          sportFilter={sportFilter}
          onSportFilterChange={(v) => { setSportFilter(v); setPage(0); }}
          sportCodesInUse={sportCodesInUse}
          locationFilter={locationFilter}
          onLocationFilterChange={(v) => { setLocationFilter(v); setPage(0); }}
          locations={locations}
          userFilter={userFilter}
          onUserFilterChange={(v) => { setUserFilter(v); setPage(0); }}
          users={users}
        />

        {/* ════════ Booking list ════════ */}
        {loading ? (
          <SkeletonTable rows={6} cols={5} />
        ) : loadError ? (
          <EmptyState
            icon={loadError === "network" ? "wifi-off" : "clipboard"}
            title={loadError === "network" ? "You\u2019re offline" : `Failed to load ${config.labelPlural.toLowerCase()}`}
            description={loadError === "network" ? "Check your connection and try again." : "Something went wrong \u2014 usually temporary."}
            actionLabel="Retry"
            onAction={reload}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon="clipboard"
            title={search || statusFilter || sportFilter || locationFilter || userFilter || specialFilter
              ? `No ${config.labelPlural.toLowerCase()} match your filters`
              : `No ${config.labelPlural.toLowerCase()} yet`}
            description={search || statusFilter || sportFilter || locationFilter || userFilter || specialFilter
              ? "Try a different search term or clear filters to see all results."
              : `${config.label.charAt(0).toUpperCase() + config.label.slice(1)}s you create will appear here.`}
          />
        ) : (
          <>
            {viewMode === "cards" ? (
              /* ════════ Card grid ════════ */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                {sortedItems.map((item) => (
                  <BookingCard
                    key={item.id}
                    item={item}
                    overdueStatus={config.overdueStatus}
                    onClick={() => setSelectedBookingId(item.id)}
                    menuProps={{
                      currentUserId, currentUserRole, config, extendingId,
                      onViewDetails: (id) => setSelectedBookingId(id),
                      onExtend: handleExtendFromMenu,
                      items, reload, setItems,
                    }}
                  />
                ))}
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="max-md:hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortHeader label="Name" sortKey="title" currentSort={sort} onSort={(s) => { setSort(s); setPage(0); }} />
                        <SortHeader label={config.startLabel} sortKey="startsAt" currentSort={sort} onSort={(s) => { setSort(s); setPage(0); }} />
                        <SortHeader label={config.endLabel} sortKey="endsAt" currentSort={sort} onSort={(s) => { setSort(s); setPage(0); }} />
                        <TableHead className="hidden md:table-cell">Duration</TableHead>
                        <TableHead className="hidden md:table-cell">{config.requesterLabel}</TableHead>
                        <TableHead className="hidden md:table-cell">Items</TableHead>
                        <TableHead className="w-11" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedItems.map((item) => (
                        <BookingTableRow
                          key={item.id}
                          item={item}
                          overdueStatus={config.overdueStatus}
                          onClick={() => setSelectedBookingId(item.id)}
                          menuProps={{
                            currentUserId, currentUserRole, config, extendingId,
                            onViewDetails: (id) => setSelectedBookingId(id),
                            onExtend: handleExtendFromMenu,
                            items, reload, setItems,
                          }}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile card list */}
                <div className="hidden max-md:flex max-md:flex-col">
                  {sortedItems.map((item) => (
                    <BookingMobileCard
                      key={item.id}
                      item={item}
                      overdueStatus={config.overdueStatus}
                      onClick={() => setSelectedBookingId(item.id)}
                      menuProps={{
                        currentUserId, currentUserRole, config, extendingId,
                        onViewDetails: (id) => setSelectedBookingId(id),
                        onExtend: handleExtendFromMenu,
                        items, reload, setItems,
                      }}
                    />
                  ))}
                </div>
              </>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm text-muted-foreground">
                <span>Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}</span>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious onClick={() => setPage(page - 1)} aria-disabled={page === 0} className={page === 0 ? "pointer-events-none opacity-50" : "cursor-pointer"} />
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext onClick={() => setPage(page + 1)} aria-disabled={page >= totalPages - 1} className={page >= totalPages - 1 ? "pointer-events-none opacity-50" : "cursor-pointer"} />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        )}
      </Card>

      {/* ════════ Booking details sheet ════════ */}
      {selectedBookingId && (
        <Suspense>
          <BookingDetailsSheet
            bookingId={selectedBookingId}
            onClose={() => { setSelectedBookingId(null); setInitialSheetTab(null); }}
            onUpdated={reload}
          />
        </Suspense>
      )}

      {/* Create flow is now at /checkouts/new and /reservations/new */}
    </>
  );
}
