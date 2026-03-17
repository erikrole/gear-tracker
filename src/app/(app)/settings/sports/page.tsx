"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import type { SportConfig } from "./types";
import { AREAS, defaultShiftConfigs } from "./types";
import ShiftConfigTable from "./ShiftConfigTable";
import RosterPanel from "./RosterPanel";

export default function SportsSettingsPage() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<SportConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSport, setExpandedSport] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const loadConfigs = useCallback(async () => {
    try {
      const res = await fetch("/api/sport-configs");
      if (res.ok) {
        const json = await res.json();
        setConfigs(json.data);
      }
    } catch {
      toast("Failed to load sport configs", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

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

  async function updateShiftCount(
    sportCode: string,
    area: string,
    type: "homeCount" | "awayCount",
    value: number
  ) {
    const config = getConfig(sportCode);
    if (!config) return;

    const updatedConfigs = AREAS.map((a) => {
      const existing = config.shiftConfigs.find((sc) => sc.area === a);
      if (a === area) {
        return {
          area: a,
          homeCount: type === "homeCount" ? value : (existing?.homeCount ?? 0),
          awayCount: type === "awayCount" ? value : (existing?.awayCount ?? 0),
        };
      }
      return { area: a, homeCount: existing?.homeCount ?? 0, awayCount: existing?.awayCount ?? 0 };
    });

    setSaving(`${sportCode}-${area}-${type}`);
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

  function handleExpand(sportCode: string) {
    setExpandedSport(expandedSport === sportCode ? null : sportCode);
  }

  if (loading) {
    return (
      <div className="settings-split">
        <div className="settings-sidebar">
          <h2 className="settings-title">Sports</h2>
        </div>
        <div className="settings-main">
          <div className="loading-spinner"><div className="spinner" /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-split">
      <div className="settings-sidebar">
        <h2 className="settings-title">Sports</h2>
        <p className="settings-desc">
          Configure shift coverage for each sport. Set the number of positions per area
          for home and away events. Manage the roster of students and staff assigned to each sport.
        </p>
      </div>

      <div className="settings-main">
        <ShiftConfigTable
          configs={configs}
          saving={saving}
          expandedSport={expandedSport}
          onToggleActive={toggleActive}
          onUpdateShift={updateShiftCount}
          onExpand={handleExpand}
        />

        {expandedSport && (
          <RosterPanel sportCode={expandedSport} />
        )}
      </div>
    </div>
  );
}
