"use client";

import { useEffect, useState } from "react";
import { useFetch } from "@/hooks/use-fetch";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { NativeSelect } from "@/components/ui/native-select";
import { PlusIcon, Trash2Icon, GripVerticalIcon } from "lucide-react";
import { FadeUp } from "@/components/ui/motion";
import { parseErrorMessage } from "@/lib/errors";

type Preset = { label: string; minutes: number };

const DURATION_OPTIONS = [
  { label: "15 min", minutes: 15 },
  { label: "30 min", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "2 hours", minutes: 120 },
  { label: "4 hours", minutes: 240 },
  { label: "12 hours", minutes: 720 },
  { label: "1 day", minutes: 1440 },
  { label: "2 days", minutes: 2880 },
  { label: "3 days", minutes: 4320 },
  { label: "5 days", minutes: 7200 },
  { label: "1 week", minutes: 10080 },
  { label: "2 weeks", minutes: 20160 },
  { label: "1 month", minutes: 43200 },
];

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${minutes / 60}h`;
  if (minutes < 10080) return `${minutes / 1440}d`;
  return `${minutes / 10080}w`;
}

export default function BookingSettingsPage() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const { data: settingsData, loading } = useFetch<{ presets: Preset[] }>({
    url: "/api/settings/extend-presets",
    refetchOnFocus: false,
  });

  // Sync fetched presets into local state (only on initial load)
  useEffect(() => {
    if (settingsData?.presets && !dirty) {
      setPresets(settingsData.presets);
    }
  }, [settingsData, dirty]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function addPreset() {
    if (presets.length >= 10) return;
    setPresets((prev) => [...prev, { label: "+1 day", minutes: 1440 }]);
    setDirty(true);
  }

  function removePreset(index: number) {
    setPresets((prev) => prev.filter((_, i) => i !== index));
    setDirty(true);
  }

  function updatePresetLabel(index: number, label: string) {
    setPresets((prev) => prev.map((p, i) => i === index ? { ...p, label } : p));
    setDirty(true);
  }

  function updatePresetMinutes(index: number, minutes: number) {
    setPresets((prev) => prev.map((p, i) => i === index ? { ...p, minutes } : p));
    setDirty(true);
  }

  async function save() {
    if (saving || presets.length === 0) return;
    // Validate all labels are non-empty
    if (presets.some((p) => !p.label.trim())) {
      toast.error("All presets need a label");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/settings/extend-presets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presets: presets.map((p) => ({ label: p.label.trim(), minutes: p.minutes })) }),
      });
      if (!res.ok) {
        const msg = await parseErrorMessage(res, "Failed to save");
        throw new Error(msg);
      }
      toast.success("Extend presets saved");
      setDirty(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    }
    setSaving(false);
  }

  return (
    <FadeUp>
    <div className="grid grid-cols-[260px_1fr] gap-8 items-start max-lg:grid-cols-1 max-lg:gap-4">
      <div className="sticky top-20 max-lg:static">
        <h2 className="text-2xl font-bold mb-2">Extend Presets</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Configure the preset buttons shown when extending a booking&apos;s due date.
        </p>
      </div>

      <div className="min-w-0 space-y-6">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Extend due date presets</CardTitle>
            <Button size="sm" onClick={save} disabled={!dirty || saving}>
              {saving ? "Saving..." : dirty ? "Save changes" : "Saved"}
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="h-9 flex-1" />
                    <Skeleton className="h-9 w-[120px]" />
                    <Skeleton className="h-9 w-9" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {presets.map((preset, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <GripVerticalIcon className="size-4 text-muted-foreground/40 shrink-0" />
                    <Input
                      value={preset.label}
                      onChange={(e) => updatePresetLabel(index, e.target.value)}
                      placeholder="Button label"
                      className="h-9 flex-1"
                    />
                    <NativeSelect
                      value={preset.minutes}
                      onChange={(e) => updatePresetMinutes(index, Number(e.target.value))}
                    >
                      {DURATION_OPTIONS.map((d) => (
                        <option key={d.minutes} value={d.minutes}>{d.label}</option>
                      ))}
                    </NativeSelect>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => removePreset(index)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2Icon className="size-3.5" />
                    </Button>
                  </div>
                ))}

                {presets.length < 10 && (
                  <Button variant="outline" size="sm" onClick={addPreset} className="mt-2">
                    <PlusIcon className="size-3.5 mr-1" />
                    Add preset
                  </Button>
                )}

                {presets.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No presets configured. Users will only see the custom option.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
    </FadeUp>
  );
}
