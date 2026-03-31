"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
const BookingDetailsSheet = dynamic(() => import("@/components/BookingDetailsSheet"), { ssr: false });
const CreateBookingSheet = dynamic(() => import("@/components/CreateBookingSheet"), { ssr: false });
import { useToast } from "@/components/Toast";
import { SkeletonTable } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

import {
  SortHeader,
  BookingFilters,
  BookingTableRow,
  BookingMobileCard,
  BookingCard,
  roundTo15Min,
  toLocalDateTimeValue,
  type BookingItem,
  type BookingListConfig,
  type StatusOption,
  type ContextMenuExtra,
  type FormUser,
  type Location,
  type BulkSkuOption,
  type ListResponse,
} from "./booking-list";

/* ───── Re-exports for backward compatibility ───── */
export type { BookingItem, BookingListConfig, StatusOption, ContextMenuExtra };

/* ───── Component ───── */

export default function BookingListPage({ config, viewMode = "table", hideHeader = false }: { config: BookingListConfig; viewMode?: "table" | "cards"; hideHeader?: boolean }) {
  const { toast } = useToast();
  const urlParams = useSearchParams();

  // ── List state ──
  const [items, setItems] = useState<BookingItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<false | "network" | "server">(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("");
  const [statusFilter, setStatusFilter] = useState(urlParams.get("status") || config.defaultStatusFilter || "");
  const [sportFilter, setSportFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [specialFilter, setSpecialFilter] = useState(urlParams.get("filter") || "");

  // ── Form options (shared with filters and create sheet) ──
  const [users, setUsers] = useState<FormUser[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [bulkSkus, setBulkSkus] = useState<BulkSkuOption[]>([]);

  // ── Create sheet state ──
  const [showCreate, setShowCreate] = useState(
    urlParams.get("create") === "true" || !!urlParams.get("title") || !!urlParams.get("draftId") || !!urlParams.get("newFor")
  );
  const [draftId, setDraftId] = useState<string | null>(urlParams.get("draftId"));

  // ── Current user (for initial requester + list menus) ──
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [currentUserRole, setCurrentUserRole] = useState<string>("");
  const [initialRequester, setInitialRequester] = useState<string>("");

  // ── Sheet + menu ──
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [extendingId, setExtendingId] = useState<string | null>(null);
  const extendingRef = useRef(false);
  const listAbortRef = useRef<AbortController | null>(null);
  const hasLoadedRef = useRef(false);

  const limit = 20;

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

  // ── Data fetching ──

  const reload = useCallback(async () => {
    // Abort previous in-flight request to prevent stale data
    listAbortRef.current?.abort();
    const controller = new AbortController();
    listAbortRef.current = controller;

    if (!hasLoadedRef.current) setLoading(true);
    setLoadError(false);
    try {
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
      const res = await fetch(`${config.apiBase}?${params}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (res.ok) {
        const json: ListResponse = await res.json();
        setItems(json.data ?? []);
        setTotal(json.total ?? 0);
        hasLoadedRef.current = true;
      } else {
        setLoadError("server");
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setLoadError("network");
    }
    if (!controller.signal.aborted) setLoading(false);
  }, [page, search, sort, statusFilter, sportFilter, locationFilter, userFilter, specialFilter, config.apiBase, config.hasSportFilter]);

  useEffect(() => {
    reload();
    return () => listAbortRef.current?.abort();
  }, [reload]);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    fetch("/api/form-options", { signal })
      .then((res) => res.ok ? res.json() : null)
      .then((json) => {
        if (signal.aborted || !json?.data) return;
        setUsers(json.data.users || []);
        setLocations(json.data.locations || []);
        setBulkSkus(json.data.bulkSkus || []);
      })
      .catch((err) => { if (err?.name !== "AbortError") toast("Failed to load filter options", "error"); });
    fetch("/api/me", { signal })
      .then((res) => res.ok ? res.json() : null)
      .then((json) => {
        if (signal.aborted) return;
        if (json?.user) {
          setCurrentUserId(json.user.id || "");
          setCurrentUserRole(json.user.role || "");
          if (json.user.id) setInitialRequester(json.user.id);
          if (urlParams.get("mine") === "true" && json.user.id) {
            setUserFilter(json.user.id);
          }
        }
      })
      .catch((err) => { if (err?.name !== "AbortError") toast("Couldn\u2019t verify your session \u2014 some features may be limited", "error"); });
    return () => controller.abort();
  }, []);

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
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (res.ok) {
        toast(`Extended by ${days} day${days !== 1 ? "s" : ""}`, "success");
      } else {
        const json = await res.json().catch(() => ({}));
        toast((json as Record<string, string>).error || "Extend failed", "error");
      }
      await reload();
    } catch {
      toast("Network error \u2014 please try again.", "error");
    }
    extendingRef.current = false;
    setExtendingId(null);
  }

  // ── Create sheet callbacks ──

  async function handleCreated(bookingId: string) {
    setSelectedBookingId(bookingId);
    await reload();
  }

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
          <Button onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? "Close" : `New ${config.label}`}
          </Button>
        </div>
      )}
      {hideHeader && (
        <div className="flex justify-end px-4 pt-3">
          <Button onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? "Close" : `New ${config.label}`}
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
          <EmptyState icon="clipboard" title={`No ${config.labelPlural.toLowerCase()} found`} description="Try adjusting your search or filters." />
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
                <div className="overflow-x-auto max-md:hidden">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <SortHeader label="Name" sortKey="title" currentSort={sort} onSort={(s) => { setSort(s); setPage(0); }} />
                        <SortHeader label="From" sortKey="startsAt" currentSort={sort} onSort={(s) => { setSort(s); setPage(0); }} />
                        <SortHeader label="To" sortKey="endsAt" currentSort={sort} onSort={(s) => { setSort(s); setPage(0); }} />
                        <th className="hide-mobile">Duration</th>
                        <th className="hide-mobile">User</th>
                        <th className="hide-mobile">Items</th>
                        <th className="w-11"></th>
                      </tr>
                    </thead>
                    <tbody>
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
                    </tbody>
                  </table>
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
              <div className="pagination">
                <span>Showing {page * limit + 1}-{Math.min((page + 1) * limit, total)} of {total}</span>
                <div className="pagination-btns">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next</Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* ════════ Booking details sheet ════════ */}
      <BookingDetailsSheet
        bookingId={selectedBookingId}
        onClose={() => setSelectedBookingId(null)}
        onUpdated={reload}
        currentUserRole={currentUserRole}
      />

      {/* ════════ Create booking sheet ════════ */}
      <CreateBookingSheet
        open={showCreate}
        onOpenChange={setShowCreate}
        config={config}
        users={users}
        locations={locations}
        bulkSkus={bulkSkus}
        onCreated={handleCreated}
        draftId={draftId}
        onDraftIdChange={setDraftId}
        initialTitle={urlParams.get("title") || ""}
        initialStartsAt={urlParams.get("startsAt") ? toLocalDateTimeValue(new Date(urlParams.get("startsAt")!)) : undefined}
        initialEndsAt={urlParams.get("endsAt") ? toLocalDateTimeValue(new Date(urlParams.get("endsAt")!)) : undefined}
        initialLocationId={urlParams.get("locationId") || undefined}
        initialRequester={initialRequester}
        initialAssetIds={urlParams.get("newFor") ? [urlParams.get("newFor")!] : undefined}
        initialEventId={urlParams.get("eventId") || undefined}
        initialSportCode={urlParams.get("sportCode") || undefined}
      />
    </>
  );
}
