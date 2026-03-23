"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type EscalationRule = {
  id: string;
  hoursFromDue: number;
  type: string;
  title: string;
  notifyRequester: boolean;
  notifyAdmins: boolean;
  enabled: boolean;
  sortOrder: number;
};

type EscalationConfig = {
  maxNotificationsPerBooking: number;
};

export default function EscalationSettingsPage() {
  const { toast } = useToast();
  const [rules, setRules] = useState<EscalationRule[]>([]);
  const [config, setConfig] = useState<EscalationConfig>({ maxNotificationsPerBooking: 10 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/escalation");
      if (res.ok) {
        const json = await res.json();
        setRules(json.data.rules);
        setConfig(json.data.config);
      }
    } catch {
      toast("Failed to load escalation settings", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  async function toggleRule(ruleId: string, field: "enabled" | "notifyAdmins" | "notifyRequester", current: boolean) {
    setSaving(ruleId + field);
    try {
      const res = await fetch("/api/settings/escalation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleId, [field]: !current }),
      });
      if (res.ok) {
        setRules((prev) => prev.map((r) => r.id === ruleId ? { ...r, [field]: !current } : r));
      } else {
        const json = await res.json().catch(() => ({}));
        toast((json as Record<string, string>).error || "Update failed", "error");
      }
    } catch {
      toast("Network error", "error");
    }
    setSaving(null);
  }

  async function updateCap(newCap: number) {
    setSaving("cap");
    try {
      const res = await fetch("/api/settings/escalation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxNotificationsPerBooking: newCap }),
      });
      if (res.ok) {
        setConfig({ maxNotificationsPerBooking: newCap });
        toast("Cap updated", "success");
      } else {
        const json = await res.json().catch(() => ({}));
        toast((json as Record<string, string>).error || "Update failed", "error");
      }
    } catch {
      toast("Network error", "error");
    }
    setSaving(null);
  }

  function formatHours(h: number): string {
    if (h < 0) return `${Math.abs(h)}h before due`;
    if (h === 0) return "At due time";
    return `${h}h after due`;
  }

  if (loading) {
    return (
      <div className="settings-split">
        <div className="settings-sidebar">
          <h2 className="settings-title">Escalation</h2>
        </div>
        <div className="settings-main">
          <div className="flex items-center justify-center py-10"><Spinner className="size-8" /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-split">
      <div className="settings-sidebar">
        <h2 className="settings-title">Escalation</h2>
        <p className="settings-desc">
          Configure when and how overdue checkout notifications are sent.
          Notifications are deduped per booking — each trigger fires at most once.
        </p>
      </div>

      <div className="settings-main">
        {/* Rules table */}
        <Card className="mb-1">
          <CardHeader><CardTitle>Notification Triggers</CardTitle></CardHeader>
          <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Trigger</th>
                <th>Timing</th>
                <th>Requester</th>
                <th>Admins</th>
                <th>Enabled</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id}>
                  <td>{rule.title}</td>
                  <td>{formatHours(rule.hoursFromDue)}</td>
                  <td>
                    <button
                      className={`toggle${rule.notifyRequester ? " on" : ""}`}
                      onClick={() => toggleRule(rule.id, "notifyRequester", rule.notifyRequester)}
                      disabled={saving === rule.id + "notifyRequester"}
                    />
                  </td>
                  <td>
                    <button
                      className={`toggle${rule.notifyAdmins ? " on" : ""}`}
                      onClick={() => toggleRule(rule.id, "notifyAdmins", rule.notifyAdmins)}
                      disabled={saving === rule.id + "notifyAdmins"}
                    />
                  </td>
                  <td>
                    <button
                      className={`toggle${rule.enabled ? " on" : ""}`}
                      onClick={() => toggleRule(rule.id, "enabled", rule.enabled)}
                      disabled={saving === rule.id + "enabled"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Card>

        {/* Fatigue controls */}
        <Card>
          <CardHeader><CardTitle>Fatigue Controls</CardTitle></CardHeader>
          <div className="p-4">
            <div className="flex gap-3 items-center">
              <label htmlFor="cap" className="text-sm font-semibold">
                Max notifications per booking
              </label>
              <Select
                value={String(config.maxNotificationsPerBooking)}
                onValueChange={(v) => updateCap(Number(v))}
                disabled={saving === "cap"}
              >
                <SelectTrigger id="cap" style={{ width: 80 }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[5, 10, 15, 20, 50].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-secondary mt-2 m-0">
              Once a booking reaches this limit, no further notifications will be sent for it.
              This prevents alert fatigue for long-overdue items.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
