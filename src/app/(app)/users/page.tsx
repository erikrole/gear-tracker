"use client";

import { useEffect, useMemo, useState } from "react";
import EmptyState from "@/components/EmptyState";
import type { UserRow, Location, Role, SortKey, ListResponse } from "./types";
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
import { ArrowUpDown, Loader2, Network, RefreshCw, WifiOff } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useFetch } from "@/hooks/use-fetch";
import { PageHeader } from "@/components/PageHeader";
import { FadeUp } from "@/components/ui/motion";
import { formatRelativeTime } from "@/lib/format";
import { useDebounce } from "@/hooks/use-url-state";

const LIMIT = 50;

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

/* ── Page Component ────────────────────────────────────── */

export default function UsersPage() {
  // Filters & sort
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [roleFilter, setRoleFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [sort, setSort] = useState<SortKey | string>("name");
  const [showInactive, setShowInactive] = useState(false);
  const [page, setPage] = useState(0);

  // UI
  const [showCreate, setShowCreate] = useState(false);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [debouncedSearch, roleFilter, locationFilter, sort, showInactive]);

  // ── Build URL for user list fetch ──
  const usersUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", String(LIMIT));
    params.set("offset", String(page * LIMIT));
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (sort) params.set("sort", sort);
    if (roleFilter) params.set("role", roleFilter);
    if (locationFilter) params.set("locationId", locationFilter);
    if (showInactive) params.set("active", "all");
    return `/api/users?${params}`;
  }, [page, debouncedSearch, sort, roleFilter, locationFilter, showInactive]);

  const {
    data: listData,
    loading,
    error: loadError,
    lastRefreshed: lastFetched,
    reload,
  } = useFetch<ListResponse>({
    url: usersUrl,
    transform: (json) => json as unknown as ListResponse,
  });

  const users = listData?.data ?? [];
  const total = listData?.total ?? 0;

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
  const hasFilters = !!search || !!roleFilter || !!locationFilter;
  const isInitialLoad = loading && users.length === 0 && !loadError;

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
        <Button asChild variant="outline" size="sm">
          <Link href="/users/org-chart">
            <Network className="mr-1 size-4" /> Org chart
          </Link>
        </Button>
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
        onCreated={reload}
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
          showInactive={showInactive}
          onShowInactiveChange={setShowInactive}
          onClearAll={() => {
            setRoleFilter("");
            setLocationFilter("");
            setShowInactive(false);
          }}
        />

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
                      <SortableHead label="Name" sortKey="name" currentSort={sort} onSort={setSort} />
                      <SortableHead label="Role" sortKey="role" currentSort={sort} onSort={setSort} />
                      <TableHead className="hidden lg:table-cell">Title / Year</TableHead>
                      <TableHead className="hidden md:table-cell">Location</TableHead>
                      <TableHead className="hidden md:table-cell">Area</TableHead>
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
