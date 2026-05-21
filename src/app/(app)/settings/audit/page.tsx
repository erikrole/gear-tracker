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
import { handleAuthRedirect, classifyError, isAbortError } from "@/lib/errors";
import { SettingsPageShell } from "../SettingsPageShell";

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
type Filters = {
  entityType: string;
  action: string;
  from: string;
  to: string;
};

const EMPTY_FILTERS: Filters = { entityType: "", action: "", from: "", to: "" };
const POLL_INTERVAL_MS = 30_000;

function buildCursor(row: AuditRow): string {
  const json = JSON.stringify({ createdAt: row.createdAt, id: row.id });
  return btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function buildUrl(base: string, filters: Filters, extra?: Record<string, string>): string {
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
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [draftFilters, setDraftFilters] = useState<Filters>(EMPTY_FILTERS);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const newestCursorRef = useRef<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPage = useCallback(async (appliedFilters: Filters) => {
    setLoading(true);
    setError(null);
    setRows([]);
    setNextCursor(null);
    newestCursorRef.current = null;
    setNewCount(0);
    try {
      const res = await fetch(buildUrl("/api/audit", appliedFilters));
      if (handleAuthRedirect(res, "/settings/audit")) return;
      if (!res.ok) { setError("server"); return; }
      const json: { data: AuditRow[]; nextCursor: string | null; hasMore: boolean; retentionDays: number } = await res.json();
      setRows(json.data);
      setNextCursor(json.nextCursor);
      setRetentionDays(json.retentionDays);
      const first = json.data[0];
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
      if (!res.ok) return;
      const json: AuditResponse = await res.json();
      if (json.data.length === 0) return;
      setRows((prev) => [...json.data, ...prev]);
      const newest = json.data[0];
      if (newest) newestCursorRef.current = buildCursor(newest);
      setNewCount((n) => n + json.data.length);
    } catch {
      // silently ignore poll errors
    }
  }, [filters]);

  useEffect(() => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    if (autoRefresh) {
      pollTimerRef.current = setInterval(pollForNew, POLL_INTERVAL_MS);
    }
    return () => { if (pollTimerRef.current) clearInterval(pollTimerRef.current); };
  }, [autoRefresh, pollForNew]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(buildUrl("/api/audit", filters, { cursor: nextCursor }));
      if (!res.ok) { toast.error("Failed to load more entries."); return; }
      const json: AuditResponse = await res.json();
      setRows((prev) => [...prev, ...json.data]);
      setNextCursor(json.nextCursor);
    } catch (err) {
      if (isAbortError(err)) return;
      toast.error("Failed to load more entries.");
    } finally {
      setLoadingMore(false);
    }
  }

  function applyFilters() {
    setFilters(draftFilters);
    setNewCount(0);
  }

  function clearFilters() {
    setDraftFilters(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setNewCount(0);
  }

  const hasActiveFilters = Object.values(filters).some(Boolean);
  const hasDraftChanges = JSON.stringify(draftFilters) !== JSON.stringify(filters);

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
            <Label className="text-xs">Entity type</Label>
            <Input
              placeholder="e.g. Item, User"
              value={draftFilters.entityType}
              onChange={(e) => setDraftFilters((d) => ({ ...d, entityType: e.target.value }))}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Action contains</Label>
            <Input
              placeholder="e.g. create, update"
              value={draftFilters.action}
              onChange={(e) => setDraftFilters((d) => ({ ...d, action: e.target.value }))}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">From</Label>
            <Input
              type="date"
              value={draftFilters.from}
              onChange={(e) => setDraftFilters((d) => ({ ...d, from: e.target.value }))}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <Input
              type="date"
              value={draftFilters.to}
              onChange={(e) => setDraftFilters((d) => ({ ...d, to: e.target.value }))}
              className="h-8 text-sm"
            />
          </div>
        </div>
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
        <div className="flex justify-center pt-1">
          <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Load older entries"}
          </Button>
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
