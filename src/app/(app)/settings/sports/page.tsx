"use client";

import { useCallback, useEffect, useState } from "react";
import { WifiOff, AlertTriangle, RotateCcw } from "lucide-react";
import { useToast } from "@/components/Toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { SportConfig } from "./types";
import { AREAS, defaultShiftConfigs } from "./types";
import ShiftConfigTable from "./ShiftConfigTable";

type FetchError = { type: "network" | "server"; message: string };

export default function SportsSettingsPage() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<SportConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FetchError | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const loadConfigs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sport-configs");
      if (!res.ok) {
        setError({
          type: "server",
          message: `Server returned ${res.status}`,
        });
        return;
      }
      const json = await res.json();
      setConfigs(json.data);
    } catch {
      setError({
        type: "network",
        message: "Could not reach the server. Check your connection and try again.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConfigs(); }, [loadConfigs]);

  function getConfig(sportCode: string) {
    return configs.find((c) => c.sportCode === sportCode);
  }

  async function toggleActive(sportCode: string) {
    const config = getConfig(sportCode);
    const newActive = !config?.active;
    setSaving(sportCode + "-toggle");
    try {
      if (!config) {
        const res = await fetch("/api/sport-configs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sportCode,
            active: true,
            shiftConfigs: defaultShiftConfigs(),
          }),
        });
        if (res.ok) {
          const json = await res.json();
          setConfigs((prev) => [...prev, json.data]);
        }
      } else {
        const res = await fetch(`/api/sport-configs/${sportCode}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: newActive }),
        });
        if (res.ok) {
          setConfigs((prev) =>
            prev.map((c) => (c.sportCode === sportCode ? { ...c, active: newActive } : c))
          );
        }
      }
    } catch {
      toast("Network error", "error");
    }
    setSaving(null);
  }

  async function updateShiftCount(sportCode: string, area: string, value: number) {
    const config = getConfig(sportCode);
    if (!config) return;

    // Set both homeCount and awayCount to the same value for backward compatibility
    const updatedConfigs = AREAS.map((a) => {
      const existing = config.shiftConfigs.find((sc) => sc.area === a);
      const count = a === area ? value : (existing?.homeCount ?? 0);
      return { area: a, homeCount: count, awayCount: count };
    });

    setSaving(`${sportCode}-${area}`);
    try {
      const res = await fetch(`/api/sport-configs/${sportCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shiftConfigs: updatedConfigs }),
      });
      if (res.ok) {
        const json = await res.json();
        setConfigs((prev) =>
          prev.map((c) => (c.sportCode === sportCode ? json.data : c))
        );
      }
    } catch {
      toast("Network error", "error");
    }
    setSaving(null);
  }

  /* ---------- Loading skeleton ---------- */
  if (loading) {
    return (
      <div className="grid grid-cols-[260px_1fr] gap-8 items-start max-md:grid-cols-1 max-md:gap-4">
        <div className="sticky top-20 max-md:static">
          <h2 className="text-[22px] font-bold mb-2">Sports</h2>
        </div>
        <div className="min-w-0">
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 rounded-md border p-4">
                <Skeleton className="h-5 w-10 rounded-full" />
                <Skeleton className="h-5 w-32" />
                <div className="ml-auto flex gap-2">
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Error state ---------- */
  if (error) {
    const Icon = error.type === "network" ? WifiOff : AlertTriangle;
    return (
      <div className="grid grid-cols-[260px_1fr] gap-8 items-start max-md:grid-cols-1 max-md:gap-4">
        <div className="sticky top-20 max-md:static">
          <h2 className="text-[22px] font-bold mb-2">Sports</h2>
        </div>
        <div className="min-w-0">
          <Card className="mx-auto max-w-md">
            <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
              <Icon className="size-10 text-muted-foreground" />
              <div>
                <p className="font-semibold">
                  {error.type === "network" ? "Connection failed" : "Something went wrong"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
              </div>
              <Button variant="outline" onClick={loadConfigs}>
                <RotateCcw className="mr-2 size-4" />
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  /* ---------- Normal render ---------- */
  return (
    <div className="grid grid-cols-[260px_1fr] gap-8 items-start max-md:grid-cols-1 max-md:gap-4">
      <div className="sticky top-20 max-md:static">
        <h2 className="text-[22px] font-bold mb-2">Sports</h2>
        <p className="text-[var(--text-secondary)] text-sm leading-relaxed m-0">
          Configure the default number of shifts per area for each sport.
          When new events are synced from the calendar, shifts are auto-generated using these counts.
          You can always adjust individual events on the schedule page.
        </p>
      </div>

      <div className="min-w-0">
        <ShiftConfigTable
          configs={configs}
          saving={saving}
          onToggleActive={toggleActive}
          onUpdateShift={updateShiftCount}
        />
      </div>
    </div>
  );
}
