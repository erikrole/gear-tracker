"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import { formatDateTime } from "@/lib/format";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
      if (res.ok) {
        setSources((prev) =>
          prev.map((s) => s.id === source.id ? { ...s, enabled: !s.enabled } : s)
        );
        toast(`${source.name} ${source.enabled ? "disabled" : "enabled"}`, "success");
      } else {
        const json = await res.json().catch(() => ({}));
        toast((json as Record<string, string>).error || "Toggle failed", "error");
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
      if (res.ok) {
        toast(`Synced ${source.name}`, "success");
        load();
      } else {
        const json = await res.json().catch(() => ({}));
        toast((json as Record<string, string>).error || "Sync failed", "error");
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
      if (res.ok) {
        setNewName("");
        setNewUrl("");
        setShowAdd(false);
        toast("Calendar source added", "success");
        load();
      } else {
        const json = await res.json().catch(() => ({}));
        toast((json as Record<string, string>).error || "Add failed", "error");
      }
    } catch {
      toast("Network error", "error");
    }
    setAddBusy(false);
  }

  function healthBadge(source: CalendarSource) {
    if (!source.enabled) return <span className="badge badge-gray">disabled</span>;
    if (source.lastError) return <span className="badge badge-red" title={source.lastError}>error</span>;
    if (!source.lastFetchedAt) return <span className="badge badge-gray">never synced</span>;
    const lastSync = new Date(source.lastFetchedAt);
    const hoursSince = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);
    if (hoursSince > 24) return <span className="badge badge-yellow">stale</span>;
    return <span className="badge badge-green">healthy</span>;
  }

  return (
    <div className="settings-split">
      <div className="settings-sidebar">
        <h2>Calendar Sources</h2>
        <p className="text-secondary text-sm">
          Manage ICS calendar feeds for event syncing. Events are automatically imported and used for shift scheduling.
        </p>
      </div>

      <div className="settings-main">
        <div className="action-row">
          {!showAdd && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
              Add source
            </button>
          )}
        </div>

        {showAdd && (
          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
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
                  <button type="submit" className="btn btn-primary btn-sm" disabled={addBusy}>
                    {addBusy ? "Adding..." : "Add"}
                  </button>
                  <button type="button" className="btn btn-sm" onClick={() => { setShowAdd(false); setNewName(""); setNewUrl(""); }}>
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="card" style={{ padding: 40, textAlign: "center" }}>
            <Spinner className="size-8" />
          </div>
        ) : sources.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>
            No calendar sources configured. Add one to start syncing events.
          </div>
        ) : (
          <div className="card">
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
                        <button
                          className="btn btn-sm"
                          onClick={() => handleToggle(source)}
                          disabled={toggling === source.id}
                        >
                          {source.enabled ? "Disable" : "Enable"}
                        </button>
                        <button
                          className="btn btn-sm"
                          onClick={() => handleSync(source)}
                          disabled={syncing === source.id || !source.enabled}
                          title={!source.enabled ? "Enable source first" : undefined}
                        >
                          {syncing === source.id ? "Syncing..." : "Sync now"}
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDelete(source)}
                        >
                          Delete
                        </button>
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
          </div>
        )}
      </div>
    </div>
  );
}
