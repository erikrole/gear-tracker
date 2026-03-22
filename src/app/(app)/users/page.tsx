"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import EmptyState from "@/components/EmptyState";
import type { UserRow, Location, Role, SortKey, ListResponse } from "./types";
import { UserTableRow, UserMobileCard } from "./UserRow";
import UserFilters from "./UserFilters";
import CreateUserCard from "./CreateUserCard";
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
import { ArrowUpDown } from "lucide-react";

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
  // List state
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Filters & sort
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [sort, setSort] = useState<SortKey | string>("name");

  // Form options
  const [locations, setLocations] = useState<Location[]>([]);

  // Auth
  const [currentUserRole, setCurrentUserRole] = useState<Role | null>(null);
  const canEdit = currentUserRole === "ADMIN" || currentUserRole === "STAFF";

  // UI
  const [showCreate, setShowCreate] = useState(false);

  // ── Data fetching ──

  const abortRef = useRef<AbortController | null>(null);

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

      const res = await fetch(`/api/users?${params}`, { signal: controller.signal });
      if (res.ok) {
        const json: ListResponse = await res.json();
        setUsers(json.data ?? []);
        setTotal(json.total ?? 0);
      } else {
        setLoadError(true);
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") setLoadError(true);
    }
    if (!controller.signal.aborted) setLoading(false);
  }, [page, search, sort, roleFilter, locationFilter]);

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
  useEffect(() => { setPage(0); }, [search, roleFilter, locationFilter, sort]);

  const totalPages = Math.ceil(total / LIMIT);
  const hasFilters = !!search || !!roleFilter || !!locationFilter;

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-7 flex-col sm:flex-row gap-3">
        <h1>Users</h1>
        {canEdit && !showCreate && (
          <Button onClick={() => setShowCreate(true)}>
            Add user
          </Button>
        )}
      </div>

      {/* Create Form (toggleable) */}
      {canEdit && showCreate && (
        <CreateUserCard
          locations={locations}
          onCreated={reload}
          onClose={() => setShowCreate(false)}
        />
      )}

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
          onClearAll={() => {
            setRoleFilter("");
            setLocationFilter("");
          }}
        />

        {loading ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {Array.from({ length: 4 }, (_, i) => (
                    <TableHead key={i}>
                      <Skeleton className="h-4 w-20" />
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 8 }, (_, r) => (
                  <TableRow key={r}>
                    {Array.from({ length: 4 }, (_, c) => (
                      <TableCell key={c}>
                        <Skeleton className="h-4" style={{ width: `${50 + ((r + c) % 4) * 12}%` }} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : loadError ? (
          <EmptyState
            icon="users"
            title="Failed to load users"
            description="Something went wrong. Please try again."
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Showing {page * LIMIT + 1}&ndash;{Math.min((page + 1) * LIMIT, total)} of {total}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
