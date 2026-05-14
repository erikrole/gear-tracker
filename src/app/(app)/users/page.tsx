"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import EmptyState from "@/components/EmptyState";
import type { UserRow, Location, Role, SortKey, ListResponse } from "./types";
import { AREA_LABELS, STUDENT_YEAR_OPTIONS } from "./types";
import { UserTableRow, UserMobileCard } from "./UserRow";
import UserFilters from "./UserFilters";
import CreateUserDialog from "./CreateUserCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { ArrowUpDown, Download, Loader2, Network, RefreshCw, WifiOff } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useFetch } from "@/hooks/use-fetch";
import { PageHeader } from "@/components/PageHeader";
import { FadeUp } from "@/components/ui/motion";
import { formatRelativeTime } from "@/lib/format";
import { useUrlState } from "@/hooks/use-url-state";
import { SPORT_CODES } from "@/lib/sports";

const LIMIT = 50;
const ROLE_VALUES = new Set<string>(["ADMIN", "STAFF", "STUDENT"]);
const SORT_VALUES = new Set([
  "",
  "name",
  "name_desc",
  "role",
  "role_desc",
  "email",
  "email_desc",
  "created",
  "created_desc",
  "lastActive",
  "lastActive_desc",
]);
const YEAR_VALUES = new Set<string>(STUDENT_YEAR_OPTIONS.map((option) => option.value));
const AREA_VALUES = new Set(Object.keys(AREA_LABELS));
const SPORT_VALUES = new Set<string>(SPORT_CODES.map((sport) => sport.code));

function parseStringParam(raw: string | null): string {
  return raw?.trim() ?? "";
}

function serializeOptionalString(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseRoleParam(raw: string | null): string {
  return raw && ROLE_VALUES.has(raw) ? raw : "";
}

function parseYearParam(raw: string | null): string {
  return raw && YEAR_VALUES.has(raw) ? raw : "";
}

function parseAreaParam(raw: string | null): string {
  return raw && AREA_VALUES.has(raw) ? raw : "";
}

function parseSportParam(raw: string | null): string {
  return raw && SPORT_VALUES.has(raw) ? raw : "";
}

function parseSortParam(raw: string | null): SortKey | string {
  return raw && SORT_VALUES.has(raw) ? raw : "name";
}

function serializeSortParam(value: SortKey | string): string | null {
  return value && value !== "name" ? value : null;
}

function parseInactiveParam(raw: string | null): boolean {
  return raw === "all";
}

function serializeInactiveParam(value: boolean): string | null {
  return value ? "all" : null;
}

function parsePageParam(raw: string | null): number {
  const page = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(page) && page > 0 ? page : 0;
}

function serializePageParam(value: number): string | null {
  return value > 0 ? String(value) : null;
}

/* ── Sort Header ───────────────────────────────────────── */

function SortableHead({
  label,
  sortKey,
  currentSort,
  onSort,
  className,
}: {
  label: string;
  sortKey: string;
  currentSort: string;
  onSort: (s: string) => void;
  className?: string;
}) {
  const isAsc = currentSort === sortKey;
  const isDesc = currentSort === `${sortKey}_desc`;
  const isActive = isAsc || isDesc;

  function handleClick() {
    if (!isActive) onSort(sortKey);
    else if (isAsc) onSort(`${sortKey}_desc`);
    else onSort("");
  }

  return (
    <TableHead className={className}>
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8"
        onClick={handleClick}
      >
        {label}
        {isActive ? (
          <span className="ml-1 text-xs">{isAsc ? "\u2191" : "\u2193"}</span>
        ) : (
          <ArrowUpDown className="ml-1 size-3.5 opacity-50" />
        )}
      </Button>
    </TableHead>
  );
}

function RosterSummary({ stats, canEdit }: { stats: NonNullable<ListResponse["stats"]>; canEdit: boolean }) {
  const buckets = [
    { label: "Total", value: stats.total },
    { label: "Active", value: stats.active },
    { label: "Students", value: stats.byRole.STUDENT },
    { label: "Staff", value: stats.byRole.STAFF + stats.byRole.ADMIN },
  ];

  if (stats.inactive > 0) {
    buckets.splice(2, 0, { label: "Inactive", value: stats.inactive });
  }

  if (canEdit && stats.missingPhotos > 0) {
    buckets.push({ label: "No photos", value: stats.missingPhotos });
  }

  const desktopCols = buckets.length >= 6 ? "lg:grid-cols-6" : "lg:grid-cols-5";

  return (
    <div className={`grid grid-cols-2 gap-2 rounded-md border border-border/60 bg-muted/20 p-2 sm:grid-cols-3 ${desktopCols}`}>
      {buckets.map((bucket) => (
        <div key={bucket.label} className="flex min-h-14 items-center justify-between rounded-sm bg-background px-3 shadow-xs">
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-muted-foreground">
              {bucket.label}
            </div>
            <div className="mt-0.5 text-xl font-bold leading-none tabular-nums" style={{ fontFamily: "var(--font-heading)" }}>
              {bucket.value.toLocaleString()}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Page Component ────────────────────────────────────── */

export default function UsersPage() {
  // Filters & sort
  const [search, setSearch] = useUrlState<string>(
    "q",
    parseStringParam,
    serializeOptionalString,
  );
  const [roleFilter, setRoleFilter] = useUrlState<string>(
    "role",
    parseRoleParam,
    serializeOptionalString,
  );
  const [locationFilter, setLocationFilter] = useUrlState<string>(
    "locationId",
    parseStringParam,
    serializeOptionalString,
  );
  const [yearFilter, setYearFilter] = useUrlState<string>(
    "year",
    parseYearParam,
    serializeOptionalString,
  );
  const [sportFilter, setSportFilter] = useUrlState<string>(
    "sport",
    parseSportParam,
    serializeOptionalString,
  );
  const [areaFilter, setAreaFilter] = useUrlState<string>(
    "area",
    parseAreaParam,
    serializeOptionalString,
  );
  const [sort, setSort] = useUrlState<SortKey | string>(
    "sort",
    parseSortParam,
    serializeSortParam,
  );
  const [showInactive, setShowInactive] = useUrlState<boolean>(
    "active",
    parseInactiveParam,
    serializeInactiveParam,
  );
  const [page, setPage] = useUrlState<number>(
    "page",
    parsePageParam,
    serializePageParam,
  );

  // UI
  const [showCreate, setShowCreate] = useState(false);
  const didMountRef = useRef(false);

  // Reset page when filters change
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    setPage(0);
  }, [search, roleFilter, locationFilter, yearFilter, sportFilter, areaFilter, sort, showInactive, setPage]);

  // ── Build URL for user list fetch ──
  const usersUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", String(LIMIT));
    params.set("offset", String(page * LIMIT));
    const query = search.trim();
    if (query) params.set("q", query);
    if (sort) params.set("sort", sort);
    if (roleFilter) params.set("role", roleFilter);
    if (locationFilter) params.set("locationId", locationFilter);
    if (yearFilter) params.set("year", yearFilter);
    if (sportFilter) params.set("sport", sportFilter);
    if (areaFilter) params.set("area", areaFilter);
    if (showInactive) params.set("active", "all");
    return `/api/users?${params}`;
  }, [page, search, sort, roleFilter, locationFilter, yearFilter, sportFilter, areaFilter, showInactive]);

  const exportHref = useMemo(() => {
    const params = new URLSearchParams();
    const query = search.trim();
    if (query) params.set("q", query);
    if (roleFilter) params.set("role", roleFilter);
    if (locationFilter) params.set("locationId", locationFilter);
    if (yearFilter) params.set("year", yearFilter);
    if (sportFilter) params.set("sport", sportFilter);
    if (areaFilter) params.set("area", areaFilter);
    if (showInactive) params.set("active", "all");
    const qs = params.toString();
    return qs ? `/api/users/export?${qs}` : "/api/users/export";
  }, [search, roleFilter, locationFilter, yearFilter, sportFilter, areaFilter, showInactive]);

  const {
    data: listData,
    loading,
    refreshing,
    error: loadError,
    lastRefreshed: lastFetched,
    reload,
  } = useFetch<ListResponse>({
    url: usersUrl,
    transform: (json) => json as unknown as ListResponse,
    keepPreviousData: true,
  });

  const users = listData?.data ?? [];
  const total = listData?.total ?? 0;
  const stats = listData?.stats;

  // Form options
  const { data: formOptions } = useFetch<{ locations: Location[] }>({
    url: "/api/form-options",
    transform: (json) => (json as Record<string, unknown>).data as { locations: Location[] },
    refetchOnFocus: false,
  });
  const locations = formOptions?.locations ?? [];

  // Auth
  const { data: meData } = useFetch<{ id: string; role: Role }>({
    url: "/api/me",
    transform: (json) => (json as Record<string, unknown>).user as { id: string; role: Role },
    refetchOnFocus: false,
  });
  const currentUserRole = meData?.role ?? null;
  const canEdit = currentUserRole === "ADMIN" || currentUserRole === "STAFF";

  const totalPages = Math.ceil(total / LIMIT);
  const hasFilters = !!search.trim() || !!roleFilter || !!locationFilter || !!yearFilter || !!sportFilter || !!areaFilter || showInactive;
  const isInitialLoad = loading && users.length === 0 && !loadError;

  useEffect(() => {
    if (loading || page === 0) return;
    if (total === 0 || page >= totalPages) {
      setPage(Math.max(0, totalPages - 1));
    }
  }, [loading, page, setPage, total, totalPages]);

  return (
    <FadeUp>
      {/* Header */}
      <PageHeader title="Users">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7" onClick={reload} disabled={loading} aria-label="Refresh users list">
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {lastFetched
              ? `Updated ${formatRelativeTime(lastFetched.toISOString(), new Date())}`
              : "Refresh"}
          </TooltipContent>
        </Tooltip>
        {canEdit && (
          <Button asChild variant="outline" size="sm">
            <a
              href={exportHref}
              download
            >
              <Download className="mr-1 size-4" /> Export CSV
            </a>
          </Button>
        )}
        {canEdit && (
          <Button asChild variant="outline" size="sm">
            <Link href="/users/org-chart">
              <Network className="mr-1 size-4" /> Org chart
            </Link>
          </Button>
        )}
        {canEdit && (
          <Button onClick={() => setShowCreate(true)}>
            Add user
          </Button>
        )}
      </PageHeader>

      {/* Create User Dialog */}
      <CreateUserDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        locations={locations}
        currentUserRole={currentUserRole}
        onCreated={() => reload()}
      />

      {/* Users List */}
      <div className="space-y-4">
        <UserFilters
          search={search}
          onSearchChange={setSearch}
          roleFilter={roleFilter}
          onRoleChange={setRoleFilter}
          locationFilter={locationFilter}
          onLocationChange={setLocationFilter}
          locations={locations}
          yearFilter={yearFilter}
          onYearChange={setYearFilter}
          sportFilter={sportFilter}
          onSportChange={setSportFilter}
          areaFilter={areaFilter}
          onAreaChange={setAreaFilter}
          showInactive={showInactive}
          onShowInactiveChange={setShowInactive}
          searching={refreshing && !loading}
          onClearAll={() => {
            setRoleFilter("");
            setLocationFilter("");
            setYearFilter("");
            setSportFilter("");
            setAreaFilter("");
            setShowInactive(false);
          }}
        />

        {stats && !isInitialLoad && !loadError && (
          <RosterSummary stats={stats} canEdit={canEdit} />
        )}

        {isInitialLoad ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><Skeleton className="h-4 w-16" /></TableHead>
                  <TableHead><Skeleton className="h-4 w-12" /></TableHead>
                  <TableHead className="hidden lg:table-cell"><Skeleton className="h-4 w-20" /></TableHead>
                  <TableHead className="hidden md:table-cell"><Skeleton className="h-4 w-20" /></TableHead>
                  <TableHead className="hidden md:table-cell"><Skeleton className="h-4 w-14" /></TableHead>
                  <TableHead className="hidden xl:table-cell"><Skeleton className="h-4 w-20" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 8 }, (_, r) => (
                  <TableRow key={r}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Skeleton className="size-8 rounded-full shrink-0" />
                        <div className="space-y-1.5 flex-1">
                          <Skeleton className="h-3.5" style={{ width: `${55 + (r % 3) * 15}%` }} />
                          <Skeleton className="h-3" style={{ width: `${40 + (r % 4) * 10}%` }} />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Skeleton className="h-5 w-14 rounded-full" /></TableCell>
                    <TableCell className="hidden lg:table-cell"><Skeleton className="h-3.5" style={{ width: `${45 + (r % 3) * 15}%` }} /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-3.5" style={{ width: `${50 + (r % 3) * 20}%` }} /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-3.5" style={{ width: `${40 + (r % 4) * 15}%` }} /></TableCell>
                    <TableCell className="hidden xl:table-cell"><Skeleton className="h-3.5 w-16" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : loadError ? (
          <EmptyState
            icon={loadError === "network" ? "wifi-off" : "users"}
            title={loadError === "network" ? "You\u2019re offline" : "Failed to load users"}
            description={loadError === "network"
              ? "Check your internet connection and try again."
              : "Something went wrong \u2014 usually temporary."}
            actionLabel="Retry"
            onAction={reload}
          />
        ) : users.length === 0 ? (
          <EmptyState
            icon="users"
            title={hasFilters ? "No users match your filters" : "No users yet"}
            description={
              hasFilters
                ? "Try adjusting your search or filters."
                : canEdit
                  ? "Click \"Add user\" to get started."
                  : undefined
            }
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHead label="Name" sortKey="name" currentSort={sort} onSort={setSort} className="w-[26rem] normal-case tracking-normal" />
                      <SortableHead label="Role" sortKey="role" currentSort={sort} onSort={setSort} className="w-28 normal-case tracking-normal" />
                      <TableHead className="hidden min-w-[16rem] normal-case tracking-normal lg:table-cell">Title</TableHead>
                      <TableHead className="hidden w-32 normal-case tracking-normal md:table-cell">Area</TableHead>
                      <TableHead className="hidden w-40 normal-case tracking-normal md:table-cell">Location</TableHead>
                      <SortableHead label="Last active" sortKey="lastActive" currentSort={sort} onSort={setSort} className="hidden w-36 normal-case tracking-normal xl:table-cell" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <UserTableRow key={user.id} user={user} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Mobile cards */}
            <div className="block sm:hidden space-y-2">
              {users.map((user) => (
                <UserMobileCard key={user.id} user={user} />
              ))}
            </div>
          </>
        )}

        {/* Pagination / Count */}
        {!isInitialLoad && !loadError && users.length > 0 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {totalPages > 1
                ? <>Showing {page * LIMIT + 1}&ndash;{Math.min((page + 1) * LIMIT, total)} of {total}</>
                : <>{total} {total === 1 ? "user" : "users"}{hasFilters ? " found" : ""}</>
              }
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                  Next
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </FadeUp>
  );
}
