"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { ArrowUpDown, Loader2, RefreshCw, WifiOff } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const LIMIT = 50;

function formatRelativeShort(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
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

/* ── Page Component ────────────────────────────────────── */

export default function UsersPage() {
  // List state
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<false | "network" | "server">(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  // Filters & sort
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [sort, setSort] = useState<SortKey | string>("name");
  const [showInactive, setShowInactive] = useState(false);

  // Form options
  const [locations, setLocations] = useState<Location[]>([]);

  // Auth
  const [currentUserRole, setCurrentUserRole] = useState<Role | null>(null);
  const canEdit = currentUserRole === "ADMIN" || currentUserRole === "STAFF";

  // UI
  const [showCreate, setShowCreate] = useState(false);

  // ── Data fetching ──

  const abortRef = useRef<AbortController | null>(null);
  const hasDataRef = useRef(false);

  const reload = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setLoadError(false);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(LIMIT));
      params.set("offset", String(page * LIMIT));
      if (search) params.set("q", search);
      if (sort) params.set("sort", sort);
      if (roleFilter) params.set("role", roleFilter);
      if (locationFilter) params.set("locationId", locationFilter);
      if (showInactive) params.set("active", "all");

      const res = await fetch(`/api/users?${params}`, { signal: controller.signal });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (res.ok) {
        const json: ListResponse = await res.json();
        setUsers(json.data ?? []);
        setTotal(json.total ?? 0);
        setLoadError(false);
        setLastFetched(new Date());
        hasDataRef.current = (json.data ?? []).length > 0;
      } else if (!hasDataRef.current) {
        setLoadError("server");
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError" && !hasDataRef.current) {
        setLoadError(navigator.onLine === false ? "network" : "server");
      }
    }
    if (!controller.signal.aborted) setLoading(false);
  }, [page, search, sort, roleFilter, locationFilter, showInactive]);

  useEffect(() => {
    reload();
    return () => { abortRef.current?.abort(); };
  }, [reload]);

  // Load form options + current user role once
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch("/api/form-options", { signal: controller.signal }),
      fetch("/api/me", { signal: controller.signal }),
    ]).then(async ([optionsRes, meRes]) => {
      if (optionsRes.ok) {
        const j = await optionsRes.json();
        setLocations(j.data?.locations || []);
      }
      if (meRes.ok) {
        const j = await meRes.json();
        if (j?.user?.role) setCurrentUserRole(j.user.role);
      }
    }).catch(() => { /* auxiliary data — don't block the page */ });
    return () => { controller.abort(); };
  }, []);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [search, roleFilter, locationFilter, sort, showInactive]);

  const totalPages = Math.ceil(total / LIMIT);
  const hasFilters = !!search || !!roleFilter || !!locationFilter;
  const isInitialLoad = loading && users.length === 0 && !loadError;
  const isRefreshing = loading && users.length > 0;

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-7 flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2">
          <h1>Users</h1>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-7" onClick={reload} disabled={loading}>
                <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {lastFetched
                ? `Updated ${formatRelativeShort(lastFetched)}`
                : "Refresh"}
            </TooltipContent>
          </Tooltip>
        </div>
        {canEdit && (
          <Button onClick={() => setShowCreate(true)}>
            Add user
          </Button>
        )}
      </div>

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
    </>
  );
}
