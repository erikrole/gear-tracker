"use client";

import { SPORT_CODES, sportLabel } from "@/lib/sports";
import type { SportConfig } from "./types";
import { AREAS, AREA_LABELS, getCount } from "./types";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function ShiftConfigTable({
  configs,
  saving,
  onToggleActive,
  onUpdateShift,
}: {
  configs: SportConfig[];
  saving: string | null;
  onToggleActive: (sportCode: string) => void;
  onUpdateShift: (sportCode: string, area: string, value: number) => void;
}) {
  function getConfig(sportCode: string) {
    return configs.find((c) => c.sportCode === sportCode);
  }

  function getShiftCount(sportCode: string, area: string): number {
    const config = getConfig(sportCode);
    if (!config) return 0;
    const sc = config.shiftConfigs.find((s) => s.area === area);
    return sc ? getCount(sc) : 0;
  }

  return (
    <Card>
      <CardHeader><CardTitle>Default Shift Coverage</CardTitle></CardHeader>

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
            </tr>
          </thead>
          <tbody>
            {SPORT_CODES.map(({ code }) => {
              const config = getConfig(code);
              const isActive = config?.active ?? false;

              return (
                <tr key={code}>
                  <td>
                    <span className="font-semibold">{code}</span>
                    <span className="text-muted-foreground ml-2 text-sm">{sportLabel(code)}</span>
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
                        <Input
                          type="number"
                          min={0}
                          max={20}
                          value={getShiftCount(code, area)}
                          onChange={(e) =>
                            onUpdateShift(code, area, Math.max(0, parseInt(e.target.value) || 0))
                          }
                          className="w-14 text-center inline-block"
                          disabled={saving?.startsWith(code + "-" + area) ?? false}
                        />
                      ) : (
                        <span className="text-muted-foreground">&mdash;</span>
                      )}
                    </td>
                  ))}
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

          return (
            <div key={code} className="sport-mobile-card">
              <div className="sport-mobile-top">
                <div>
                  <span className="font-semibold">{code}</span>
                  <span className="text-muted-foreground ml-2 text-sm">{sportLabel(code)}</span>
                </div>
                <button
                  className={`toggle${isActive ? " on" : ""}`}
                  onClick={() => onToggleActive(code)}
                  disabled={saving === code + "-toggle"}
                />
              </div>
              {isActive && (
                <div className="sport-mobile-shifts">
                  {AREAS.map((area) => (
                    <div key={area} className="sport-mobile-shift-row">
                      <span className="text-sm text-muted-foreground">{AREA_LABELS[area]}</span>
                      <Input
                        type="number"
                        min={0}
                        max={20}
                        value={getShiftCount(code, area)}
                        onChange={(e) =>
                          onUpdateShift(code, area, Math.max(0, parseInt(e.target.value) || 0))
                        }
                        className="w-14 text-center"
                        disabled={saving?.startsWith(code + "-" + area) ?? false}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <CardContent>
        <p className="text-sm text-muted-foreground m-0">
          Set the default number of shifts per area for each sport. These are used when new events are synced from the calendar.
          You can adjust individual events on the schedule page.
        </p>
      </CardContent>
    </Card>
  );
}
