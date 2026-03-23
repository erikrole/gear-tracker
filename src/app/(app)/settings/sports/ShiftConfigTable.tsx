"use client";

import { SPORT_CODES, sportLabel } from "@/lib/sports";
import type { SportConfig, ShiftConfig } from "./types";
import { AREAS, AREA_LABELS, defaultShiftConfigs } from "./types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function ShiftConfigTable({
  configs,
  saving,
  expandedSport,
  onToggleActive,
  onUpdateShift,
  onExpand,
}: {
  configs: SportConfig[];
  saving: string | null;
  expandedSport: string | null;
  onToggleActive: (sportCode: string) => void;
  onUpdateShift: (sportCode: string, area: string, type: "homeCount" | "awayCount", value: number) => void;
  onExpand: (sportCode: string) => void;
}) {
  function getConfig(sportCode: string) {
    return configs.find((c) => c.sportCode === sportCode);
  }

  function getShiftCount(sportCode: string, area: string, type: "homeCount" | "awayCount"): number {
    const config = getConfig(sportCode);
    if (!config) return 0;
    const sc = config.shiftConfigs.find((s) => s.area === area);
    return sc?.[type] ?? 0;
  }

  return (
    <Card>
      <CardHeader><CardTitle>Sport Coverage</CardTitle></CardHeader>

      {/* Desktop table */}
      <div className="data-table-wrap hide-mobile-only">
        <table className="data-table">
          <thead>
            <tr>
              <th>Sport</th>
              <th>Active</th>
              {AREAS.map((a) => (
                <th key={a} style={{ textAlign: "center" }}>{AREA_LABELS[a]}</th>
              ))}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {SPORT_CODES.map(({ code }) => {
              const config = getConfig(code);
              const isExpanded = expandedSport === code;
              const isActive = config?.active ?? false;

              return (
                <tr key={code} className={isExpanded ? "row-expanded" : undefined}>
                  <td>
                    <span className="font-semibold">{code}</span>
                    <span className="text-secondary ml-2 text-sm">{sportLabel(code)}</span>
                  </td>
                  <td>
                    <button
                      className={`toggle${isActive ? " on" : ""}`}
                      onClick={() => onToggleActive(code)}
                      disabled={saving === code + "-toggle"}
                    />
                  </td>
                  {AREAS.map((area) => (
                    <td key={area} style={{ textAlign: "center" }}>
                      {isActive ? (
                        <span className="text-sm">
                          <Input
                            type="number"
                            min={0}
                            max={20}
                            value={getShiftCount(code, area, "homeCount")}
                            onChange={(e) =>
                              onUpdateShift(code, area, "homeCount", Math.max(0, parseInt(e.target.value) || 0))
                            }
                            style={{ width: 40, textAlign: "center", display: "inline-block" }}
                            title="Home"
                            disabled={saving?.startsWith(code + "-" + area) ?? false}
                          />
                          <span className="text-secondary mx-4">/</span>
                          <Input
                            type="number"
                            min={0}
                            max={20}
                            value={getShiftCount(code, area, "awayCount")}
                            onChange={(e) =>
                              onUpdateShift(code, area, "awayCount", Math.max(0, parseInt(e.target.value) || 0))
                            }
                            style={{ width: 40, textAlign: "center", display: "inline-block" }}
                            title="Away"
                            disabled={saving?.startsWith(code + "-" + area) ?? false}
                          />
                        </span>
                      ) : (
                        <span className="text-secondary">&mdash;</span>
                      )}
                    </td>
                  ))}
                  <td>
                    {isActive && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onExpand(code)}
                      >
                        {isExpanded ? "Close" : "Roster"}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="show-mobile-only">
        {SPORT_CODES.map(({ code }) => {
          const config = getConfig(code);
          const isActive = config?.active ?? false;
          const isExpanded = expandedSport === code;

          return (
            <div key={code} className="sport-mobile-card">
              <div className="sport-mobile-top">
                <div>
                  <span className="font-semibold">{code}</span>
                  <span className="text-secondary ml-2 text-sm">{sportLabel(code)}</span>
                </div>
                <button
                  className={`toggle${isActive ? " on" : ""}`}
                  onClick={() => onToggleActive(code)}
                  disabled={saving === code + "-toggle"}
                />
              </div>
              {isActive && (
                <>
                  <div className="sport-mobile-shifts">
                    {AREAS.map((area) => (
                      <div key={area} className="sport-mobile-shift-row">
                        <span className="text-sm text-secondary">{AREA_LABELS[area]}</span>
                        <span className="text-sm">
                          <Input
                            type="number"
                            min={0}
                            max={20}
                            value={getShiftCount(code, area, "homeCount")}
                            onChange={(e) =>
                              onUpdateShift(code, area, "homeCount", Math.max(0, parseInt(e.target.value) || 0))
                            }
                            style={{ width: 44, textAlign: "center", display: "inline-block" }}
                            disabled={saving?.startsWith(code + "-" + area) ?? false}
                          />
                          <span className="text-secondary mx-4">/</span>
                          <Input
                            type="number"
                            min={0}
                            max={20}
                            value={getShiftCount(code, area, "awayCount")}
                            onChange={(e) =>
                              onUpdateShift(code, area, "awayCount", Math.max(0, parseInt(e.target.value) || 0))
                            }
                            style={{ width: 44, textAlign: "center", display: "inline-block" }}
                            disabled={saving?.startsWith(code + "-" + area) ?? false}
                          />
                        </span>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onExpand(code)}
                    style={{ alignSelf: "flex-start" }}
                  >
                    {isExpanded ? "Close roster" : "Roster"}
                  </Button>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-3">
        <p className="text-sm text-secondary m-0">
          Numbers show Home / Away shift count per area. Toggle Active to enable shift generation for a sport.
        </p>
      </div>
    </Card>
  );
}
