"use client";

import { useState } from "react";
import { WifiOff, AlertTriangle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FadeUp } from "@/components/ui/motion";
import { useFetch } from "@/hooks/use-fetch";
import { handleAuthRedirect, classifyError, isAbortError } from "@/lib/errors";
import type { SportConfig } from "./types";
import { AREAS, SPORT_GROUPS, defaultShiftConfigs } from "./types";
import ShiftConfigTable from "./ShiftConfigTable";

export default function SportsSettingsPage() {
  const { data: fetchedConfigs, loading, error, reload } = useFetch<SportConfig[]>({
    url: "/api/sport-configs",
    returnTo: "/settings/sports",
    transform: (json) => (json.data as SportConfig[]) ?? [],
  });
  // Local state for optimistic updates on mutations
  const [localConfigs, setLocalConfigs] = useState<SportConfig[] | null>(null);
  const configs = localConfigs ?? fetchedConfigs ?? [];
  // Sync local state when fetch data changes
  const [prevFetched, setPrevFetched] = useState(fetchedConfigs);
  if (fetchedConfigs !== prevFetched) {
    setPrevFetched(fetchedConfigs);
    setLocalConfigs(null);
  }
  const setConfigs = (updater: SportConfig[] | ((prev: SportConfig[]) => SportConfig[])) => {
    setLocalConfigs(typeof updater === "function" ? updater(configs) : updater);
  };
  const [saving, setSaving] = useState<string | null>(null);

  function getConfig(sportCode: string) {
    return configs.find((c) => c.sportCode === sportCode);
  }

  /** Find the group that a sport code belongs to */
  function findGroup(sportCode: string) {
    return SPORT_GROUPS.find((g) => g.codes.includes(sportCode));
  }

  async function toggleActive(sportCode: string) {
    const group = findGroup(sportCode);
    const codes = group ? group.codes : [sportCode];
    const groupActive = codes.some((code) => getConfig(code)?.active);
    const nextActive = !groupActive;

    // For groups whose configs don't exist yet, the group endpoint will create
    // them on demand with default shift counts (matches single-code POST).
    const needsCreate = codes.some((code) => !getConfig(code));
    const patch: Parameters<typeof applyGroupPatch>[2] = { active: nextActive };
    if (needsCreate && nextActive) {
      patch.shiftConfigs = defaultShiftConfigs();
    }
    await applyGroupPatch(sportCode, sportCode + "-toggle", patch);
  }

  async function applyGroupPatch(
    sportCode: string,
    savingKey: string,
    patch: {
      active?: boolean;
      shiftConfigs?: SportConfig["shiftConfigs"];
      shiftStartOffset?: number;
      shiftEndOffset?: number;
    },
  ) {
    const group = findGroup(sportCode);
    const codes = group ? group.codes : [sportCode];

    setSaving(savingKey);
    try {
      const res = await fetch("/api/sport-configs/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes, ...patch }),
      });
      if (handleAuthRedirect(res, "/settings/sports")) return;
      if (res.ok) {
        const json = await res.json();
        const updated = json.data as SportConfig[];
        const byCode = new Map(updated.map((c) => [c.sportCode, c]));
        setConfigs((prev) =>
          prev.map((c) => byCode.get(c.sportCode) ?? c)
            .concat(updated.filter((c) => !prev.some((p) => p.sportCode === c.sportCode)))
        );
        const group = findGroup(sportCode);
        if (group && group.codes.length > 1) {
          toast.success(`Saved — applies to ${group.codes.join(" + ")}`);
        } else {
          toast.success("Saved");
        }
      } else if (res.status === 429) {
        toast.error("Too many changes \u2014 please slow down.");
      } else {
        toast.error("Save failed \u2014 your changes were not applied.");
      }
    } catch (err) {
      if (isAbortError(err)) return;
      const kind = classifyError(err);
      toast.error(kind === "network" ? "You\u2019re offline. Check your connection." : "Something went wrong");
    }
    setSaving(null);
  }

  async function updateShiftCount(sportCode: string, area: string, field: "homeCount" | "awayCount", value: number) {
    const config = getConfig(sportCode);
    if (!config) return;

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

    await applyGroupPatch(sportCode, `${sportCode}-${area}`, { shiftConfigs: updatedConfigs });
  }

  async function updateOffset(sportCode: string, field: "shiftStartOffset" | "shiftEndOffset", value: number) {
    await applyGroupPatch(sportCode, `${sportCode}-calltime`, { [field]: value });
  }

  /* ---------- Loading skeleton ---------- */
  if (loading) {
    return (
      <FadeUp><div className="grid grid-cols-[260px_1fr] gap-8 items-start max-lg:grid-cols-1 max-lg:gap-4">
        <div className="sticky top-20 max-lg:static">
          <h2 className="text-2xl font-bold mb-2">Sports</h2>
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
      </div></FadeUp>
    );
  }

  /* ---------- Error state ---------- */
  if (error) {
    const Icon = error === "network" ? WifiOff : AlertTriangle;
    return (
      <FadeUp><div className="grid grid-cols-[260px_1fr] gap-8 items-start max-lg:grid-cols-1 max-lg:gap-4">
        <div className="sticky top-20 max-lg:static">
          <h2 className="text-2xl font-bold mb-2">Sports</h2>
        </div>
        <div className="min-w-0">
          <Card className="mx-auto max-w-md">
            <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
              <Icon className="size-10 text-muted-foreground" />
              <div>
                <p className="font-semibold">
                  {error === "network" ? "Connection failed" : "Something went wrong"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {error === "network"
                    ? "Could not reach the server. Check your connection and try again."
                    : "Something went wrong loading sports configuration."}
                </p>
              </div>
              <Button variant="outline" onClick={reload}>
                <RotateCcw className="mr-2 size-4" />
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </div></FadeUp>
    );
  }

  /* ---------- Normal render ---------- */
  return (
    <FadeUp>
    <div className="grid grid-cols-[260px_1fr] gap-8 items-start max-lg:grid-cols-1 max-lg:gap-4">
      <div className="sticky top-20 max-lg:static">
        <h2 className="text-2xl font-bold mb-2">Sports</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
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
