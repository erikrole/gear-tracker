"use client";

import { sportLabel } from "@/lib/sports";
import type { SportConfig } from "./types";
import { AREAS, AREA_LABELS, SPORT_GROUPS, BIG_6 } from "./types";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Generate call-time options: 0, 15, 30, 45, 60 … 240 minutes */
const CALL_TIME_OPTIONS = [0, 15, 30, 45, 60, 90, 120, 150, 180, 210, 240];

function formatMinutes(mins: number): string {
  if (mins === 0) return "None";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return h === 1 ? "1 hr" : `${h} hrs`;
  return `${h}h ${m}m`;
}

export default function ShiftConfigTable({
  configs,
  saving,
  onToggleActive,
  onUpdateShift,
  onUpdateOffset,
}: {
  configs: SportConfig[];
  saving: string | null;
  onToggleActive: (sportCode: string) => void;
  onUpdateShift: (sportCode: string, area: string, field: "homeCount" | "awayCount", value: number) => void;
  onUpdateOffset: (sportCode: string, field: "shiftStartOffset" | "shiftEndOffset", value: number) => void;
}) {
  function getConfig(sportCode: string) {
    return configs.find((c) => c.sportCode === sportCode);
  }

  /** For grouped sports, use the first code's config as representative */
  function getGroupConfig(codes: string[]) {
    for (const code of codes) {
      const c = getConfig(code);
      if (c) return c;
    }
    return null;
  }

  function isGroupActive(codes: string[]) {
    return codes.some((c) => getConfig(c)?.active);
  }

  function getShiftCount(sportCode: string, area: string, field: "homeCount" | "awayCount"): number {
    const config = getConfig(sportCode);
    if (!config) return 0;
    const sc = config.shiftConfigs.find((s) => s.area === area);
    return sc ? sc[field] : 0;
  }

  return (
    <div className="space-y-4">
      {SPORT_GROUPS.map((group) => {
        const primaryCode = group.codes[0];
        const config = getGroupConfig(group.codes);
        const active = isGroupActive(group.codes);

        return (
          <Card key={group.label}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-base">{group.label}</CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {group.codes.join(", ")}
                  </span>
                </div>
                <button
                  className={`toggle${active ? " on" : ""}`}
                  onClick={() => {
                    for (const code of group.codes) {
                      onToggleActive(code);
                    }
                  }}
                  disabled={saving?.endsWith("-toggle") ?? false}
                />
              </div>
            </CardHeader>

            {active && (
              <CardContent className="pt-0 space-y-4">
                {/* Shift counts table */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm [&_th]:text-left [&_th]:px-4 [&_th]:py-2 [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground [&_th]:border-b [&_th]:border-border [&_th]:bg-muted/40 [&_td]:px-4 [&_td]:py-2.5 [&_td]:border-b [&_td]:border-border/40 [&_tr:last-child_td]:border-b-0">
                    <thead>
                      <tr>
                        <th className="w-24"></th>
                        {AREAS.map((a) => (
                          <th key={a} className="text-center">{AREA_LABELS[a]}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          <Badge variant="green" size="sm">Home</Badge>
                        </td>
                        {AREAS.map((area) => (
                          <td key={area} className="text-center">
                            <Input
                              type="number"
                              min={0}
                              max={20}
                              value={getShiftCount(primaryCode, area, "homeCount")}
                              onChange={(e) =>
                                onUpdateShift(primaryCode, area, "homeCount", Math.max(0, parseInt(e.target.value) || 0))
                              }
                              className="w-14 text-center inline-block"
                              disabled={saving?.startsWith(primaryCode) ?? false}
                            />
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td>
                          <Badge variant="red" size="sm">Away</Badge>
                        </td>
                        {AREAS.map((area) => (
                          <td key={area} className="text-center">
                            <Input
                              type="number"
                              min={0}
                              max={20}
                              value={getShiftCount(primaryCode, area, "awayCount")}
                              onChange={(e) =>
                                onUpdateShift(primaryCode, area, "awayCount", Math.max(0, parseInt(e.target.value) || 0))
                              }
                              className="w-14 text-center inline-block"
                              disabled={saving?.startsWith(primaryCode) ?? false}
                            />
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Call time config */}
                <div className="flex flex-wrap items-center gap-4 pt-1">
                  <span className="text-sm text-muted-foreground font-medium">Call time</span>
                  <div className="flex items-center gap-2">
                    <Select
                      value={String(config?.shiftStartOffset ?? 60)}
                      onValueChange={(v) => onUpdateOffset(primaryCode, "shiftStartOffset", parseInt(v))}
                      disabled={saving?.startsWith(primaryCode) ?? false}
                    >
                      <SelectTrigger className="w-[110px] h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CALL_TIME_OPTIONS.map((m) => (
                          <SelectItem key={m} value={String(m)}>{formatMinutes(m)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-muted-foreground">before</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={String(config?.shiftEndOffset ?? 60)}
                      onValueChange={(v) => onUpdateOffset(primaryCode, "shiftEndOffset", parseInt(v))}
                      disabled={saving?.startsWith(primaryCode) ?? false}
                    >
                      <SelectTrigger className="w-[110px] h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CALL_TIME_OPTIONS.map((m) => (
                          <SelectItem key={m} value={String(m)}>{formatMinutes(m)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-muted-foreground">after</span>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
