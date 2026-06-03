"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, RefreshCw, WifiOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { handleAuthRedirect, classifyError, isAbortError, parseJsonSafely } from "@/lib/errors";
import { SettingsPageShell } from "../SettingsPageShell";
import {
  auditPaginationErrorCopy,
  auditRefreshErrorCopy,
  isAuditResponsePayload,
  validateAuditFilters,
  type AuditFilters,
  type AuditPaginationErrorKind,
  type AuditRefreshErrorKind,
} from "./audit-pagination";

type AuditActor = { id: string; name: string; email: string } | null;
type AuditRow = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  createdAt: string;
  actor: AuditActor;
};
type AuditResponse = {
  data: AuditRow[];
  nextCursor: string | null;
  hasMore: boolean;
  retentionDays: number;
};
const EMPTY_FILTERS: AuditFilters = { entityType: "", action: "", from: "", to: "" };
const POLL_INTERVAL_MS = 30_000;

function buildCursor(row: AuditRow): string {
  const json = JSON.stringify({ createdAt: row.createdAt, id: row.id });
  return btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function buildUrl(base: string, filters: AuditFilters, extra?: Record<string, string>): string {
  const params = new URLSearchParams();
  if (filters.entityType) params.set("entityType", filters.entityType);
  if (filters.action) params.set("action", filters.action);
  if (filters.from) params.set("from", new Date(filters.from).toISOString());
  if (filters.to) {
    const to = new Date(filters.to);
    to.setHours(23, 59, 59, 999);
    params.set("to", to.toISOString());
  }
  if (extra) for (const [k, v] of Object.entries(extra)) params.set(k, v);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

function formatTs(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function AuditLogPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [retentionDays, setRetentionDays] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<"network" | "server" | null>(null);
  const [paginationError, setPaginationError] = useState<AuditPaginationErrorKind | null>(null);
  const [refreshError, setRefreshError] = useState<AuditRefreshErrorKind | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AuditFilters>(EMPTY_FILTERS);
  const [draftFilters, setDraftFilters] = useState<AuditFilters>(EMPTY_FILTERS);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const newestCursorRef = useRef<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPage = useCallback(async (appliedFilters: AuditFilters) => {
    setLoading(true);
    setError(null);
    setRows([]);
    setNextCursor(null);
    setPaginationError(null);
    setRefreshError(null);
    newestCursorRef.current = null;
    setNewCount(0);
    try {
      const res = await fetch(buildUrl("/api/audit", appliedFilters));
      if (handleAuthRedirect(res, "/settings/audit")) return;
      if (!res.ok) { setError("server"); return; }
      const json = await parseJsonSafely<AuditResponse>(res);
      if (!isAuditResponsePayload(json)) {
        setError("server");
        return;
      }
      const data = json.data as AuditRow[];
      setRows(data);
      setNextCursor(json.nextCursor ?? null);
      setRetentionDays(json.retentionDays ?? null);
      const first = data[0];
      if (first) newestCursorRef.current = buildCursor(first);
    } catch (err) {
      if (isAbortError(err)) return;
      setError(classifyError(err) === "network" ? "network" : "server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPage(filters); }, [filters, fetchPage]);

  const pollForNew = useCallback(async () => {
    const after = newestCursorRef.current;
    if (!after) return;
    try {
      const res = await fetch(buildUrl("/api/audit", filters, { after, limit: "100" }));
      if (handleAuthRedirect(res, "/settings/audit")) return;
      if (!res.ok) {
        setRefreshError("server");
        return;
      }
      const json = await parseJsonSafely<AuditResponse>(res);
      if (!isAuditResponsePayload(json)) {
        setRefreshError("server");
        return;
      }
      const data = json.data as AuditRow[];
      setRefreshError(null);
      if (data.length > 0) {
        setRows((prev) => [...data, ...prev]);
        const newest = data[0];
        if (newest) newestCursorRef.current = buildCursor(newest);
        setNewCount((n) => n + data.length);
      }
    } catch (err) {
      if (isAbortError(err)) return;
      setRefreshError(classifyError(err) === "network" ? "network" : "server");
    }
  }, [filters]);

  useEffect(() => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    if (!autoRefresh) setRefreshError(null);
    if (autoRefresh) {
      pollTimerRef.current = setInterval(pollForNew, POLL_INTERVAL_MS);
    }
    return () => { if (pollTimerRef.current) clearInterval(pollTimerRef.current); };
  }, [autoRefresh, pollForNew]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setPaginationError(null);
    try {
      const res = await fetch(buildUrl("/api/audit", filters, { cursor: nextCursor }));
      if (handleAuthRedirect(res, "/settings/audit")) return;
      if (!res.ok) {
        const copy = auditPaginationErrorCopy("server");
        setPaginationError("server");
        toast.error(copy.title);
        return;
      }
      const json = await parseJsonSafely<AuditResponse>(res);
      if (!isAuditResponsePayload(json)) {
        const copy = auditPaginationErrorCopy("server");
        setPaginationError("server");
        toast.error(copy.title);
        return;
      }
      const data = json.data as AuditRow[];
      setRows((prev) => [...prev, ...data]);
      setNextCursor(json.nextCursor ?? null);
      setPaginationError(null);
    } catch (err) {
      if (isAbortError(err)) return;
      const kind = classifyError(err) === "network" ? "network" : "server";
      const copy = auditPaginationErrorCopy(kind);
      setPaginationError(kind);
      toast.error(copy.title);
    } finally {
      setLoadingMore(false);
    }
  }

  function updateDraftFilter(key: keyof AuditFilters, value: string) {
    setFilterError(null);
    setDraftFilters((draft) => ({ ...draft, [key]: value }));
  }

  function applyFilters() {
    const result = validateAuditFilters(draftFilters);
    setDraftFilters(result.filters);

    if (result.error) {
      setFilterError(result.error);
      toast.error("Check audit filters");
      return;
    }

    setFilterError(null);
    setFilters(result.filters);
    setNewCount(0);
  }

  function clearFilters() {
    setFilterError(null);
    setDraftFilters(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setNewCount(0);
  }

  const hasActiveFilters = Object.values(filters).some(Boolean);
  const hasDraftChanges = JSON.stringify(draftFilters) !== JSON.stringify(filters);
  const paginationCopy = paginationError ? auditPaginationErrorCopy(paginationError) : null;
  const refreshCopy = refreshError ? auditRefreshErrorCopy(refreshError) : null;

  const description = "A real-time feed of every create, update, and delete action across the system. Visible to admins only.";

  return (
    <SettingsPageShell title="Audit Log" description={description} mainClassName="space-y-4">
      {/* Retention banner */}
      {retentionDays && (
        <p className="text-xs text-muted-foreground">
          Showing entries from the last {retentionDays} days. Older entries are pruned automatically.
        </p>
      )}

      {/* Filters */}
      <div className="rounded-md border border-border bg-muted/30 p-3 space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="audit-entity-type" className="text-xs">Entity type</Label>
            <Input
              id="audit-entity-type"
              name="entityType"
              placeholder="e.g. Item, User"
              value={draftFilters.entityType}
              onChange={(e) => updateDraftFilter("entityType", e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="audit-action" className="text-xs">Action contains</Label>
            <Input
              id="audit-action"
              name="action"
              placeholder="e.g. create, update"
              value={draftFilters.action}
              onChange={(e) => updateDraftFilter("action", e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="audit-from" className="text-xs">From</Label>
            <Input
              id="audit-from"
              name="from"
              type="date"
              value={draftFilters.from}
              onChange={(e) => updateDraftFilter("from", e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="audit-to" className="text-xs">To</Label>
            <Input
              id="audit-to"
              name="to"
              type="date"
              value={draftFilters.to}
              onChange={(e) => updateDraftFilter("to", e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        </div>
        {filterError && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>Check audit filters</AlertTitle>
            <AlertDescription>{filterError}</AlertDescription>
          </Alert>
        )}
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={applyFilters} disabled={!hasDraftChanges && !hasActiveFilters}>
            Apply
          </Button>
          {hasActiveFilters && (
            <Button size="sm" variant="ghost" onClick={clearFilters}>
              <X className="size-3.5 mr-1" />
              Clear filters
            </Button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Label htmlFor="auto-refresh" className="text-xs text-muted-foreground cursor-pointer">
              Auto-refresh
            </Label>
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
          </div>
        </div>
      </div>

      {/* New rows banner */}
      {newCount > 0 && (
        <div className="flex items-center justify-between rounded-md bg-primary/10 border border-primary/20 px-3 py-2">
          <span className="text-sm text-primary font-medium">
            {newCount} new {newCount === 1 ? "entry" : "entries"} added
          </span>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setNewCount(0)}>
            Dismiss
          </Button>
        </div>
      )}

      {autoRefresh && refreshCopy && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>{refreshCopy.title}</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{refreshCopy.description}</span>
            <Button size="sm" variant="outline" onClick={pollForNew} className="shrink-0">
              Retry now
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-1.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-md border border-border bg-card p-8 flex flex-col items-center gap-4 text-center">
          {error === "network"
            ? <WifiOff className="size-8 text-muted-foreground" />
            : <AlertTriangle className="size-8 text-muted-foreground" />}
          <p className="text-sm text-muted-foreground">
            {error === "network" ? "Could not reach the server." : "Failed to load audit entries."}
          </p>
          <Button variant="outline" size="sm" onClick={() => fetchPage(filters)}>
            Retry
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-border bg-card p-8 flex flex-col items-center gap-2 text-center">
          <RefreshCw className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {hasActiveFilters ? "No entries match these filters." : "No audit entries yet."}
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left font-medium text-muted-foreground px-3 py-2 w-44">Time</th>
                <th className="text-left font-medium text-muted-foreground px-3 py-2">Entity</th>
                <th className="text-left font-medium text-muted-foreground px-3 py-2">Action</th>
                <th className="text-left font-medium text-muted-foreground px-3 py-2">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <AuditTableRow key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Load more */}
      {nextCursor && !loading && (
        <div className="space-y-2 pt-1">
          {paginationCopy && (
            <Alert variant="destructive" className="mx-auto max-w-2xl">
              <AlertTriangle className="size-4" />
              <AlertTitle>{paginationCopy.title}</AlertTitle>
              <AlertDescription>{paginationCopy.description}</AlertDescription>
            </Alert>
          )}
          <div className="flex justify-center">
            <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? "Loading…" : paginationError ? "Retry older entries" : "Load older entries"}
            </Button>
          </div>
        </div>
      )}
    </SettingsPageShell>
  );
}

function AuditTableRow({ row }: { row: AuditRow }) {
  return (
    <tr className="hover:bg-muted/30 transition-colors">
      <td className="px-3 py-2.5 tabular-nums text-muted-foreground text-xs whitespace-nowrap">
        {formatTs(row.createdAt)}
      </td>
      <td className="px-3 py-2.5">
        <span className="font-medium">{row.entityType}</span>
        <span className="text-muted-foreground ml-1 font-mono text-xs">{row.entityId.slice(0, 8)}</span>
      </td>
      <td className="px-3 py-2.5">
        <Badge variant="secondary" className="font-mono text-xs font-normal">
          {row.action}
        </Badge>
      </td>
      <td className="px-3 py-2.5 text-muted-foreground">
        {row.actor ? row.actor.name : <span className="text-xs italic">System</span>}
      </td>
    </tr>
  );
}
