"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import { formatDateTime } from "@/lib/format";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FadeUp } from "@/components/ui/motion";
import { handleAuthRedirect, parseErrorMessage } from "@/lib/errors";
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
  const { toast } = useToast();
  const confirm = useConfirm();
  const [sources, setSources] = useState<CalendarSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  // Add form
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [addBusy, setAddBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/calendar-sources");
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        const json = await res.json();
        setSources(json.data ?? []);
      }
    } catch {
      toast("Failed to load calendar sources", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  async function handleToggle(source: CalendarSource) {
    setToggling(source.id);
    try {
      const res = await fetch(`/api/calendar-sources/${source.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !source.enabled }),
      });
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        setSources((prev) =>
          prev.map((s) => s.id === source.id ? { ...s, enabled: !s.enabled } : s)
        );
        toast(`${source.name} ${source.enabled ? "disabled" : "enabled"}`, "success");
      } else {
        const msg = await parseErrorMessage(res, "Toggle failed");
        toast(msg, "error");
      }
    } catch {
      toast("Network error", "error");
    }
    setToggling(null);
  }

  async function handleSync(source: CalendarSource) {
    setSyncing(source.id);
    try {
      const res = await fetch(`/api/calendar-sources/${source.id}/sync`, { method: "POST" });
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        const json = await res.json().catch(() => null);
        if (json?.data?.shiftGenerationError) {
          toast(`Synced ${source.name}, but shift generation failed`, "warning");
        } else {
          toast(`Synced ${source.name}`, "success");
        }
        load();
      } else {
        const msg = await parseErrorMessage(res, "Sync failed");
        toast(msg, "error");
      }
    } catch {
      toast("Network error", "error");
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
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        setSources((prev) => prev.filter((s) => s.id !== source.id));
        toast(`Deleted ${source.name}`, "success");
      } else {
        toast("Delete failed", "error");
      }
    } catch {
      toast("Network error", "error");
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
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        setNewName("");
        setNewUrl("");
        setShowAdd(false);
        toast("Calendar source added", "success");
        load();
      } else {
        const msg = await parseErrorMessage(res, "Add failed");
        toast(msg, "error");
      }
    } catch {
      toast("Network error", "error");
    }
    setAddBusy(false);
  }

  function healthBadge(source: CalendarSource) {
    if (!source.enabled) return <StatusIndicator state="idle" label="Disabled" size="sm" />;
    if (source.lastError) return <span title={source.lastError}><StatusIndicator state="down" label="Error" size="sm" /></span>;
    if (!source.lastFetchedAt) return <StatusIndicator state="idle" label="Never synced" size="sm" />;
    const lastSync = new Date(source.lastFetchedAt);
    const hoursSince = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);
    if (hoursSince > 24) return <StatusIndicator state="fixing" label="Stale" size="sm" />;
    return <StatusIndicator state="active" label="Healthy" size="sm" />;
  }

  return (
    <FadeUp>
    <div className="grid grid-cols-[260px_1fr] gap-8 items-start max-md:grid-cols-1 max-md:gap-4">
      <div className="sticky top-20 max-md:static">
        <h2>Calendar Sources</h2>
        <p className="text-secondary text-sm">
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
          <Card style={{ padding: 16, marginBottom: 16 }}>
            <form onSubmit={handleAdd}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. UW Badgers Football"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>ICS URL</Label>
                  <Input
                    type="url"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="https://example.com/calendar.ics"
                    required
                  />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
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
          <Card style={{ padding: 40, textAlign: "center" }}>
            <Spinner className="size-8" />
          </Card>
        ) : sources.length === 0 ? (
          <Card style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>
            No calendar sources configured. Add one to start syncing events.
          </Card>
        ) : (
          <Card>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Health</th>
                  <th className="hide-mobile">Events</th>
                  <th className="hide-mobile">Last synced</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((source) => (
                  <tr key={source.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{source.name}</div>
                      <div className="text-xs text-secondary" style={{ wordBreak: "break-all", maxWidth: 300 }}>
                        {source.url}
                      </div>
                    </td>
                    <td>{healthBadge(source)}</td>
                    <td className="hide-mobile">{source._count?.events ?? 0}</td>
                    <td className="hide-mobile">
                      {source.lastFetchedAt ? formatDateTime(source.lastFetchedAt) : "\u2014"}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sources.some((s) => s.lastError) && (
              <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", fontSize: "var(--text-sm)" }}>
                <strong>Errors:</strong>
                {sources.filter((s) => s.lastError).map((s) => (
                  <div key={s.id} style={{ color: "var(--red)", marginTop: 4 }}>
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
