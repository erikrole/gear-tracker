"use client";

import { useCallback, useEffect, useState } from "react";
import { SkeletonTable } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import type { UserRow, Location, Role, SortKey, ListResponse } from "./types";
import { UserTableRow, UserMobileCard } from "./UserRow";
import UserFilters from "./UserFilters";
import CreateUserCard from "./CreateUserCard";
import { Button } from "@/components/ui/button";

const LIMIT = 50;

/* ── Sort Header ───────────────────────────────────────── */

function SortTh({
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
    <th className={className || ""}>
      <button
        type="button"
        className="sort-header-btn"
        onClick={handleClick}
        aria-sort={isAsc ? "ascending" : isDesc ? "descending" : undefined}
      >
        <span className="sort-header-inner">
          {label}
          {isActive && <span className="sort-arrow">{isAsc ? "\u2191" : "\u2193"}</span>}
        </span>
      </button>
    </th>
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

  const reload = useCallback(async () => {
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

      const res = await fetch(`/api/users?${params}`);
      if (res.ok) {
        const json: ListResponse = await res.json();
        setUsers(json.data ?? []);
        setTotal(json.total ?? 0);
      } else {
        setLoadError(true);
      }
    } catch {
      setLoadError(true);
    }
    setLoading(false);
  }, [page, search, sort, roleFilter, locationFilter]);

  useEffect(() => { reload(); }, [reload]);

  // Load form options + current user role once
  useEffect(() => {
    Promise.all([
      fetch("/api/form-options"),
      fetch("/api/me"),
    ]).then(async ([optionsRes, meRes]) => {
      if (optionsRes.ok) {
        const j = await optionsRes.json();
        setLocations(j.data?.locations || []);
      }
      if (meRes.ok) {
        const j = await meRes.json();
        if (j?.user?.role) setCurrentUserRole(j.user.role);
      }
    }).catch(() => { setLoadError(true); });
  }, []);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [search, roleFilter, locationFilter, sort]);

  const totalPages = Math.ceil(total / LIMIT);
  const hasFilters = !!search || !!roleFilter || !!locationFilter;

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h1>Users</h1>
          {total > 0 && <span className="section-count">{total}</span>}
        </div>
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
      <div className="card">
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
          <SkeletonTable rows={8} cols={5} />
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
            <div className="data-table-wrap hide-mobile-only">
              <table className="data-table">
                <thead>
                  <tr>
                    <SortTh label="Name" sortKey="name" currentSort={sort} onSort={setSort} />
                    <SortTh label="Email" sortKey="email" currentSort={sort} onSort={setSort} className="hide-mobile" />
                    <SortTh label="Role" sortKey="role" currentSort={sort} onSort={setSort} />
                    <th className="hide-mobile">Location</th>
                    <th className="hide-mobile">Area</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <UserTableRow key={user.id} user={user} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="show-mobile-only">
              {users.map((user) => (
                <UserMobileCard key={user.id} user={user} />
              ))}
            </div>
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <span>
              Showing {page * LIMIT + 1}&ndash;{Math.min((page + 1) * LIMIT, total)} of {total}
            </span>
            <div className="pagination-btns">
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
