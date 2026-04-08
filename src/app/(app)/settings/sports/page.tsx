"use client";

import { useCallback, useEffect, useState } from "react";
import { WifiOff, AlertTriangle, RotateCcw } from "lucide-react";
import { useToast } from "@/components/Toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FadeUp } from "@/components/ui/motion";
import { handleAuthRedirect } from "@/lib/errors";
import type { SportConfig } from "./types";
import { AREAS, SPORT_GROUPS, defaultShiftConfigs } from "./types";
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
      if (handleAuthRedirect(res)) return;
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

  /** Find the group that a sport code belongs to */
  function findGroup(sportCode: string) {
    return SPORT_GROUPS.find((g) => g.codes.includes(sportCode));
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
        if (handleAuthRedirect(res)) return;
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
        if (handleAuthRedirect(res)) return;
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

  async function updateShiftCount(sportCode: string, area: string, field: "homeCount" | "awayCount", value: number) {
    const group = findGroup(sportCode);
    const codesToUpdate = group ? group.codes : [sportCode];

    setSaving(`${sportCode}-${area}`);
    try {
      for (const code of codesToUpdate) {
        const config = getConfig(code);
        if (!config) continue;

        const updatedConfigs = AREAS.map((a) => {
          const existing = config.shiftConfigs.find((sc) => sc.area === a);
          if (a === area) {
            return {
              area: a,
              homeCount: field === "homeCount" ? value : (existing?.homeCount ?? 0),
              awayCount: field === "awayCount" ? value : (existing?.awayCount ?? 0),
            };
          }
          return { area: a, homeCount: existing?.homeCount ?? 0, awayCount: existing?.awayCount ?? 0 };
        });

        const res = await fetch(`/api/sport-configs/${code}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shiftConfigs: updatedConfigs }),
        });
        if (handleAuthRedirect(res)) return;
        if (res.ok) {
          const json = await res.json();
          setConfigs((prev) =>
            prev.map((c) => (c.sportCode === code ? json.data : c))
          );
        }
      }
    } catch {
      toast("Network error", "error");
    }
    setSaving(null);
  }

  async function updateOffset(sportCode: string, field: "shiftStartOffset" | "shiftEndOffset", value: number) {
    const group = findGroup(sportCode);
    const codesToUpdate = group ? group.codes : [sportCode];

    setSaving(`${sportCode}-calltime`);
    try {
      for (const code of codesToUpdate) {
        const config = getConfig(code);
        if (!config) continue;

        const res = await fetch(`/api/sport-configs/${code}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        });
        if (handleAuthRedirect(res)) return;
        if (res.ok) {
          const json = await res.json();
          setConfigs((prev) =>
            prev.map((c) => (c.sportCode === code ? json.data : c))
          );
        }
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
        <div className="min-w-0 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-md border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-10 rounded-full" />
              </div>
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
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
    <FadeUp>
    <div className="grid grid-cols-[260px_1fr] gap-8 items-start max-md:grid-cols-1 max-md:gap-4">
      <div className="sticky top-20 max-md:static">
        <h2 className="text-[22px] font-bold mb-2">Sports</h2>
        <p className="text-[var(--text-secondary)] text-sm leading-relaxed m-0">
          Configure shift coverage and call times for each sport.
          Grouped sports share the same settings across men&apos;s and women&apos;s programs.
        </p>
      </div>

      <div className="min-w-0">
        <ShiftConfigTable
          configs={configs}
          saving={saving}
          onToggleActive={toggleActive}
          onUpdateShift={updateShiftCount}
          onUpdateOffset={updateOffset}
        />
      </div>
    </div>
    </FadeUp>
  );
}
