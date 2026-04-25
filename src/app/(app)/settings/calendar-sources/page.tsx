"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";
import { formatDateTime } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FadeUp } from "@/components/ui/motion";
import { useFetch } from "@/hooks/use-fetch";
import { handleAuthRedirect, classifyError, isAbortError, parseErrorMessage } from "@/lib/errors";
import StatusIndicator from "@/components/ui/status-indicator";

type CalendarSource = {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  lastFetchedAt: string | null;
  lastError: string | null;
  createdAt: string;
  _count?: { events: number };
};

export default function CalendarSourcesPage() {
  const confirm = useConfirm();
  const { data: fetchedSources, loading, reload } = useFetch<CalendarSource[]>({
    url: "/api/calendar-sources",
    returnTo: "/settings/calendar-sources",
    transform: (json) => (json.data as CalendarSource[]) ?? [],
  });
  // Local state for optimistic mutation updates
  const [localSources, setLocalSources] = useState<CalendarSource[] | null>(null);
  const sources = localSources ?? fetchedSources ?? [];
  const [prevFetched, setPrevFetched] = useState(fetchedSources);
  if (fetchedSources !== prevFetched) {
    setPrevFetched(fetchedSources);
    setLocalSources(null);
  }
  const setSources = (updater: CalendarSource[] | ((prev: CalendarSource[]) => CalendarSource[])) => {
    setLocalSources(typeof updater === "function" ? updater(sources) : updater);
  };
  const [syncing, setSyncing] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  // Add form
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [addBusy, setAddBusy] = useState(false);

  async function handleToggle(source: CalendarSource) {
    setToggling(source.id);
    try {
      const res = await fetch(`/api/calendar-sources/${source.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !source.enabled }),
      });
      if (handleAuthRedirect(res, "/settings/calendar-sources")) return;
      if (res.ok) {
        setSources((prev) =>
          prev.map((s) => s.id === source.id ? { ...s, enabled: !s.enabled } : s)
        );
        toast.success(`${source.name} ${source.enabled ? "disabled" : "enabled"}`);
      } else {
        const msg = await parseErrorMessage(res, "Toggle failed");
        toast.error(msg);
      }
    } catch (err) {
      if (isAbortError(err)) return;
      const kind = classifyError(err);
      toast.error(kind === "network" ? "You\u2019re offline. Check your connection." : "Toggle failed");
    }
    setToggling(null);
  }

  async function handleSync(source: CalendarSource) {
    setSyncing(source.id);
    try {
      const res = await fetch(`/api/calendar-sources/${source.id}/sync`, { method: "POST" });
      if (handleAuthRedirect(res, "/settings/calendar-sources")) return;
      if (res.ok) {
        const json = await res.json().catch(() => null);
        if (json?.data?.shiftGenerationError) {
          toast.warning(`Synced ${source.name}, but shift generation failed`);
        } else {
          toast.success(`Synced ${source.name}`);
        }
        reload();
      } else {
        const msg = await parseErrorMessage(res, "Sync failed");
        toast.error(msg);
      }
    } catch (err) {
      if (isAbortError(err)) return;
      const kind = classifyError(err);
      toast.error(kind === "network" ? "You\u2019re offline. Check your connection." : "Sync failed");
    }
    setSyncing(null);
  }

  async function handleDelete(source: CalendarSource) {
    const ok = await confirm({
      title: "Delete calendar source",
      message: `Delete "${source.name}"? This will also delete all ${source._count?.events ?? 0} synced events.`,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/calendar-sources/${source.id}`, { method: "DELETE" });
      if (handleAuthRedirect(res, "/settings/calendar-sources")) return;
      if (res.ok) {
        setSources((prev) => prev.filter((s) => s.id !== source.id));
        toast.success(`Deleted ${source.name}`);
      } else {
        toast.error("Delete failed");
      }
    } catch (err) {
      if (isAbortError(err)) return;
      const kind = classifyError(err);
      toast.error(kind === "network" ? "You\u2019re offline. Check your connection." : "Delete failed");
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newUrl.trim()) return;
    setAddBusy(true);
    try {
      const res = await fetch("/api/calendar-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), url: newUrl.trim() }),
      });
      if (handleAuthRedirect(res, "/settings/calendar-sources")) return;
      if (res.ok) {
        setNewName("");
        setNewUrl("");
        setShowAdd(false);
        toast.success("Calendar source added");
        reload();
      } else {
        const msg = await parseErrorMessage(res, "Add failed");
        toast.error(msg);
      }
    } catch (err) {
      if (isAbortError(err)) return;
      const kind = classifyError(err);
      toast.error(kind === "network" ? "You\u2019re offline. Check your connection." : "Add failed");
    }
    setAddBusy(false);
  }

  function healthBadge(source: CalendarSource) {
    if (!source.enabled) return <StatusIndicator state="idle" label="Disabled" size="sm" />;
    if (source.lastError) return <span title={source.lastError}><StatusIndicator state="down" label="Error" size="sm" /></span>;
    if (!source.lastFetchedAt) return <StatusIndicator state="idle" label="Never synced" size="sm" />;
    const lastSync = new Date(source.lastFetchedAt);
    const hoursSince = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);
    // Cron runs daily at 6 AM UTC (D-026); allow ~6h grace before marking stale.
    if (hoursSince > 30) return <StatusIndicator state="fixing" label="Stale" size="sm" />;
    return <StatusIndicator state="active" label="Healthy" size="sm" />;
  }

  return (
    <FadeUp>
    <div className="grid grid-cols-[260px_1fr] gap-8 items-start max-lg:grid-cols-1 max-lg:gap-4">
      <div className="sticky top-20 max-lg:static">
        <h2 className="text-2xl font-bold mb-2">Calendar Sources</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Manage ICS calendar feeds for event syncing. Events are automatically imported and used for shift scheduling.
        </p>
      </div>

      <div className="min-w-0">
        <div className="flex gap-2">
          {!showAdd && (
            <Button size="sm" onClick={() => setShowAdd(true)}>
              Add source
            </Button>
          )}
        </div>

        {showAdd && (
          <Card className="p-4 mb-4">
            <form onSubmit={handleAdd}>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Name</Label>
                  <Input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. UW Badgers Football"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>ICS URL</Label>
                  <Input
                    type="url"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="https://example.com/calendar.ics"
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={addBusy}>
                    {addBusy ? "Adding..." : "Add"}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => { setShowAdd(false); setNewName(""); setNewUrl(""); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            </form>
          </Card>
        )}

        {loading ? (
          <Card className="p-10">
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="flex items-center justify-between py-3">
                  <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              ))}
            </div>
          </Card>
        ) : sources.length === 0 ? (
          <Card className="flex items-center justify-center p-10 text-center text-muted-foreground text-sm">
            No calendar sources configured. Add one to start syncing events.
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Health</TableHead>
                  <TableHead className="hidden md:table-cell">Events</TableHead>
                  <TableHead className="hidden md:table-cell">Last synced</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.map((source) => (
                  <TableRow key={source.id}>
                    <TableCell>
                      <div className="font-semibold">{source.name}</div>
                      <div className="text-xs text-muted-foreground break-all max-w-[300px]">
                        {source.url}
                      </div>
                    </TableCell>
                    <TableCell>{healthBadge(source)}</TableCell>
                    <TableCell className="hidden md:table-cell">{source._count?.events ?? 0}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {source.lastFetchedAt ? formatDateTime(source.lastFetchedAt) : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1.5 justify-end flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggle(source)}
                          disabled={toggling === source.id}
                        >
                          {source.enabled ? "Disable" : "Enable"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSync(source)}
                          disabled={syncing === source.id || !source.enabled}
                          title={!source.enabled ? "Enable source first" : undefined}
                        >
                          {syncing === source.id ? "Syncing..." : "Sync now"}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(source)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {sources.some((s) => s.lastError) && (
              <div className="px-4 py-3 border-t text-sm">
                <strong>Errors:</strong>
                {sources.filter((s) => s.lastError).map((s) => (
                  <div key={s.id} className="text-destructive mt-1">
                    {s.name}: {s.lastError}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
    </FadeUp>
  );
}
