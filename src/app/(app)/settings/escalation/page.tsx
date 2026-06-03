"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { WifiOff, AlertTriangle, RefreshCw } from "lucide-react";
import { useFetch } from "@/hooks/use-fetch";
import { handleAuthRedirect, classifyError, isAbortError, parseErrorMessage } from "@/lib/errors";
import { SettingsPageShell } from "../SettingsPageShell";

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

type EscalationData = {
  rules: EscalationRule[];
  config: EscalationConfig;
};

type EscalationRuleField = "enabled" | "notifyAdmins" | "notifyRequester";

function ruleSavingKey(ruleId: string, field: EscalationRuleField) {
  return `${ruleId}:${field}`;
}

function describeRuleChange(rule: EscalationRule | undefined, field: EscalationRuleField, next: boolean) {
  const title = rule?.title ?? "Escalation trigger";
  if (field === "enabled") {
    return `${title} trigger ${next ? "enabled" : "disabled"}.`;
  }
  if (field === "notifyAdmins") {
    return `${title} ${next ? "now notifies admins" : "no longer notifies admins"}.`;
  }
  return `${title} ${next ? "now notifies the requester" : "no longer notifies the requester"}.`;
}

export default function EscalationSettingsPage() {
  const { data: escalationData, loading, error, reload } = useFetch<EscalationData>({
    url: "/api/settings/escalation",
    returnTo: "/settings/escalation",
    transform: (json) => (json.data as EscalationData) ?? { rules: [], config: { maxNotificationsPerBooking: 10 } },
  });
  // Local state for optimistic mutation updates
  const [localRules, setLocalRules] = useState<EscalationRule[] | null>(null);
  const [localConfig, setLocalConfig] = useState<EscalationConfig | null>(null);
  const rules = localRules ?? escalationData?.rules ?? [];
  const config = localConfig ?? escalationData?.config ?? { maxNotificationsPerBooking: 10 };
  // Sync local state when fetch data changes
  const [prevData, setPrevData] = useState(escalationData);
  if (escalationData !== prevData) {
    setPrevData(escalationData);
    setLocalRules(null);
    setLocalConfig(null);
  }
  const [saving, setSaving] = useState<string | null>(null);
  const savingRef = useRef(false);
  const anySaving = saving !== null;

  async function toggleRule(ruleId: string, field: EscalationRuleField, current: boolean) {
    if (savingRef.current) {
      toast.info("Finish the current escalation save before changing another trigger.");
      return;
    }
    const next = !current;
    const targetRule = rules.find((rule) => rule.id === ruleId);
    savingRef.current = true;
    setSaving(ruleSavingKey(ruleId, field));
    try {
      const res = await fetch("/api/settings/escalation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleId, [field]: next }),
      });
      if (handleAuthRedirect(res, "/settings/escalation")) return;
      if (res.ok) {
        setLocalRules((prev) => (prev ?? rules).map((r) => r.id === ruleId ? { ...r, [field]: next } : r));
        toast.success(describeRuleChange(targetRule, field, next));
      } else {
        const msg = await parseErrorMessage(res, "Update failed");
        toast.error(msg);
      }
    } catch (err) {
      if (isAbortError(err)) return;
      const kind = classifyError(err);
      toast.error(kind === "network" ? "You\u2019re offline. Check your connection." : "Update failed");
    } finally {
      savingRef.current = false;
      setSaving(null);
    }
  }

  async function updateCap(newCap: number) {
    if (savingRef.current) {
      toast.info("Finish the current escalation save before changing the notification cap.");
      return;
    }
    savingRef.current = true;
    setSaving("cap");
    try {
      const res = await fetch("/api/settings/escalation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxNotificationsPerBooking: newCap }),
      });
      if (handleAuthRedirect(res, "/settings/escalation")) return;
      if (res.ok) {
        setLocalConfig({ maxNotificationsPerBooking: newCap });
        toast.success(`Notification cap set to ${newCap} per booking.`);
      } else {
        const msg = await parseErrorMessage(res, "Update failed");
        toast.error(msg);
      }
    } catch (err) {
      if (isAbortError(err)) return;
      const kind = classifyError(err);
      toast.error(kind === "network" ? "You\u2019re offline. Check your connection." : "Update failed");
    } finally {
      savingRef.current = false;
      setSaving(null);
    }
  }

  function formatHours(h: number): string {
    if (h < 0) return `${Math.abs(h)}h before due`;
    if (h === 0) return "At due time";
    return `${h}h after due`;
  }

  const description = "Configure when and how overdue checkout notifications are sent. Notifications are deduped per booking, and each trigger fires at most once.";

  if (loading) {
    return (
      <SettingsPageShell title="Escalation" description={description}>
          <Card className="mb-1">
            <CardHeader><CardTitle>Notification Triggers</CardTitle></CardHeader>
            <div className="px-4 pb-4 flex flex-col gap-3">
              {/* Table header skeleton */}
              <div className="flex gap-4">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
              </div>
              {/* Table row skeletons */}
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-9 rounded-full" />
                  <Skeleton className="h-5 w-9 rounded-full" />
                  <Skeleton className="h-5 w-9 rounded-full" />
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader><CardTitle>Fatigue Controls</CardTitle></CardHeader>
            <div className="p-4 flex flex-col gap-2">
              <div className="flex gap-3 items-center">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-9 w-20 rounded-md" />
              </div>
              <Skeleton className="h-4 w-80" />
            </div>
          </Card>
      </SettingsPageShell>
    );
  }

  if (error) {
    const Icon = error === "network" ? WifiOff : AlertTriangle;
    return (
      <SettingsPageShell title="Escalation" description={description}>
          <Card>
            <div className="flex flex-col items-center justify-center gap-4 py-12 px-4 text-center">
              <Icon className="size-10 text-muted-foreground" />
              <div>
                <p className="text-sm font-semibold">
                  {error === "network" ? "Connection Failed" : "Something Went Wrong"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {error === "network"
                    ? "Could not connect to the server. Check your internet connection and try again."
                    : "Something went wrong. Please try again."}
                </p>
              </div>
              <Button variant="outline" onClick={reload}>
                <RefreshCw className="size-4" />
                Retry
              </Button>
            </div>
          </Card>
      </SettingsPageShell>
    );
  }

  return (
    <SettingsPageShell title="Escalation" description={description}>
        {/* Rules table */}
        <Card className="mb-1">
          <CardHeader>
            <CardTitle>Notification Triggers</CardTitle>
            <p className="text-xs text-muted-foreground mt-1 m-0">
              Toggle who is notified at each timing. Timings are fixed to the schedule defined in product spec D-009.
            </p>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trigger</TableHead>
                <TableHead>Timing</TableHead>
                <TableHead>Requester</TableHead>
                <TableHead>Admins</TableHead>
                <TableHead>Enabled</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>{rule.title}</TableCell>
                  <TableCell>
                    <span className="text-muted-foreground text-xs font-medium">
                      {formatHours(rule.hoursFromDue)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={rule.notifyRequester}
                      onCheckedChange={() => toggleRule(rule.id, "notifyRequester", rule.notifyRequester)}
                      disabled={anySaving}
                      aria-label={`Toggle requester notifications for ${rule.title}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={rule.notifyAdmins}
                      onCheckedChange={() => toggleRule(rule.id, "notifyAdmins", rule.notifyAdmins)}
                      disabled={anySaving}
                      aria-label={`Toggle admin notifications for ${rule.title}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={() => toggleRule(rule.id, "enabled", rule.enabled)}
                      disabled={anySaving}
                      aria-label={`Toggle ${rule.title} escalation trigger`}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
                disabled={anySaving}
              >
                <SelectTrigger id="cap" className="w-20" aria-label="Max notifications per booking">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[5, 10, 15, 20, 50].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground mt-2 m-0">
              Once a booking reaches this limit, no further notifications will be sent for it.
              This prevents alert fatigue for long-overdue items.
            </p>
          </div>
        </Card>
    </SettingsPageShell>
  );
}
