"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/Toast";

type ShiftConfig = {
  area: "VIDEO" | "PHOTO" | "GRAPHICS" | "COMMS";
  homeCount: number;
  awayCount: number;
};

type SportConfig = {
  id: string;
  sportCode: string;
  active: boolean;
  shiftConfigs: ShiftConfig[];
};

type RosterMember = {
  id: string;
  userId: string;
  user: { id: string; name: string; email: string; role: string; primaryArea: string | null };
};

const AREAS = ["VIDEO", "PHOTO", "GRAPHICS", "COMMS"] as const;
const AREA_LABELS: Record<string, string> = {
  VIDEO: "Video",
  PHOTO: "Photo",
  GRAPHICS: "Graphics",
  COMMS: "Comms",
};

const SPORT_CODES = [
  { code: "MBB", label: "Men's Basketball" },
  { code: "MXC", label: "Men's Cross Country" },
  { code: "FB", label: "Football" },
  { code: "MGOLF", label: "Men's Golf" },
  { code: "MHKY", label: "Men's Hockey" },
  { code: "MROW", label: "Men's Rowing" },
  { code: "MSOC", label: "Men's Soccer" },
  { code: "MSWIM", label: "Men's Swimming & Diving" },
  { code: "MTEN", label: "Men's Tennis" },
  { code: "MTRACK", label: "Men's Track & Field" },
  { code: "WRES", label: "Wrestling" },
  { code: "WBB", label: "Women's Basketball" },
  { code: "WXC", label: "Women's Cross Country" },
  { code: "WGOLF", label: "Women's Golf" },
  { code: "WHKY", label: "Women's Hockey" },
  { code: "LROW", label: "Lightweight Rowing" },
  { code: "WROW", label: "Women's Rowing" },
  { code: "WSOC", label: "Women's Soccer" },
  { code: "SB", label: "Softball" },
  { code: "WSWIM", label: "Women's Swimming & Diving" },
  { code: "WTEN", label: "Women's Tennis" },
  { code: "WTRACK", label: "Women's Track & Field" },
  { code: "VB", label: "Volleyball" },
];

function sportLabel(code: string): string {
  return SPORT_CODES.find((s) => s.code === code)?.label ?? code;
}

function defaultShiftConfigs(): ShiftConfig[] {
  return AREAS.map((area) => ({ area, homeCount: 1, awayCount: 1 }));
}

export default function SportsSettingsPage() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<SportConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSport, setExpandedSport] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [allUsers, setAllUsers] = useState<{ id: string; name: string; role: string }[]>([]);
  const [addUserId, setAddUserId] = useState("");

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

  function getConfig(sportCode: string): SportConfig | undefined {
    return configs.find((c) => c.sportCode === sportCode);
  }

  function getShiftCount(sportCode: string, area: string, type: "homeCount" | "awayCount"): number {
    const config = getConfig(sportCode);
    if (!config) return 0;
    const sc = config.shiftConfigs.find((s) => s.area === area);
    return sc?.[type] ?? 0;
  }

  async function toggleActive(sportCode: string) {
    const config = getConfig(sportCode);
    const newActive = !config?.active;
    setSaving(sportCode + "-toggle");
    try {
      if (!config) {
        // Create new config
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
          toast(`${sportLabel(sportCode)} enabled`, "success");
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

  async function loadRoster(sportCode: string) {
    setRosterLoading(true);
    try {
      const [rosterRes, usersRes] = await Promise.all([
        fetch(`/api/sport-configs/${sportCode}/roster`),
        fetch("/api/users"),
      ]);
      if (rosterRes.ok) {
        const json = await rosterRes.json();
        setRoster(json.data);
      }
      if (usersRes.ok) {
        const json = await usersRes.json();
        setAllUsers(json.data?.map((u: { id: string; name: string; role: string }) => ({
          id: u.id,
          name: u.name,
          role: u.role,
        })) ?? []);
      }
    } catch {
      toast("Failed to load roster", "error");
    }
    setRosterLoading(false);
  }

  async function handleExpand(sportCode: string) {
    if (expandedSport === sportCode) {
      setExpandedSport(null);
      return;
    }
    setExpandedSport(sportCode);
    await loadRoster(sportCode);
  }

  async function addToRoster(sportCode: string) {
    if (!addUserId) return;
    setSaving("add-roster");
    try {
      const res = await fetch(`/api/sport-configs/${sportCode}/roster`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: addUserId }),
      });
      if (res.ok) {
        setAddUserId("");
        await loadRoster(sportCode);
        toast("Added to roster", "success");
      } else {
        const json = await res.json().catch(() => ({}));
        toast((json as Record<string, string>).error || "Failed to add", "error");
      }
    } catch {
      toast("Network error", "error");
    }
    setSaving(null);
  }

  async function removeFromRoster(sportCode: string, assignmentId: string) {
    setSaving("remove-" + assignmentId);
    try {
      const res = await fetch(
        `/api/sport-configs/${sportCode}/roster?assignmentId=${assignmentId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setRoster((prev) => prev.filter((r) => r.id !== assignmentId));
        toast("Removed from roster", "success");
      }
    } catch {
      toast("Network error", "error");
    }
    setSaving(null);
  }

  if (loading) {
    return (
      <div className="settings-split">
        <div className="settings-sidebar">
          <h1 className="settings-title">Sports</h1>
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
        <h1 className="settings-title">Sports</h1>
        <p className="settings-desc">
          Configure shift coverage for each sport. Set the number of positions per area
          for home and away events. Manage the roster of students and staff assigned to each sport.
        </p>
      </div>

      <div className="settings-main">
        <div className="card">
          <div className="card-header"><h2>Sport Coverage</h2></div>
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
                      <span className="text-secondary ml-8 text-sm">{sportLabel(code)}</span>
                    </td>
                    <td>
                      <button
                        className={`toggle${isActive ? " on" : ""}`}
                        onClick={() => toggleActive(code)}
                        disabled={saving === code + "-toggle"}
                      />
                    </td>
                    {AREAS.map((area) => (
                      <td key={area} style={{ textAlign: "center" }}>
                        {isActive ? (
                          <span className="text-sm">
                            <input
                              type="number"
                              min={0}
                              max={20}
                              value={getShiftCount(code, area, "homeCount")}
                              onChange={(e) =>
                                updateShiftCount(code, area, "homeCount", Math.max(0, parseInt(e.target.value) || 0))
                              }
                              className="form-input"
                              style={{ width: 40, textAlign: "center", display: "inline-block" }}
                              title="Home"
                              disabled={saving?.startsWith(code + "-" + area) ?? false}
                            />
                            <span className="text-secondary mx-4">/</span>
                            <input
                              type="number"
                              min={0}
                              max={20}
                              value={getShiftCount(code, area, "awayCount")}
                              onChange={(e) =>
                                updateShiftCount(code, area, "awayCount", Math.max(0, parseInt(e.target.value) || 0))
                              }
                              className="form-input"
                              style={{ width: 40, textAlign: "center", display: "inline-block" }}
                              title="Away"
                              disabled={saving?.startsWith(code + "-" + area) ?? false}
                            />
                          </span>
                        ) : (
                          <span className="text-secondary">—</span>
                        )}
                      </td>
                    ))}
                    <td>
                      {isActive && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleExpand(code)}
                        >
                          {isExpanded ? "Close" : "Roster"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="p-12">
            <p className="text-sm text-secondary m-0">
              Numbers show Home / Away shift count per area. Toggle Active to enable shift generation for a sport.
            </p>
          </div>
        </div>

        {/* Expanded roster panel */}
        {expandedSport && (
          <div className="card mt-16">
            <div className="card-header">
              <h2>{sportLabel(expandedSport)} Roster</h2>
            </div>
            {rosterLoading ? (
              <div className="p-16"><div className="loading-spinner"><div className="spinner" /></div></div>
            ) : (
              <>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Area</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center text-secondary p-16">
                          No one assigned to this sport yet.
                        </td>
                      </tr>
                    )}
                    {roster.map((member) => (
                      <tr key={member.id}>
                        <td>{member.user.name}</td>
                        <td>
                          <span className={`badge badge-${member.user.role === "STUDENT" ? "blue" : "green"}`}>
                            {member.user.role}
                          </span>
                        </td>
                        <td>{member.user.primaryArea ? AREA_LABELS[member.user.primaryArea] : "—"}</td>
                        <td>
                          <button
                            className="btn btn-ghost btn-sm text-danger"
                            onClick={() => removeFromRoster(expandedSport, member.id)}
                            disabled={saving === "remove-" + member.id}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="p-12 flex gap-8 items-center">
                  <select
                    className="form-select"
                    value={addUserId}
                    onChange={(e) => setAddUserId(e.target.value)}
                    style={{ minWidth: 200 }}
                  >
                    <option value="">Select user...</option>
                    {allUsers
                      .filter((u) => !roster.some((r) => r.userId === u.id))
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.role})
                        </option>
                      ))}
                  </select>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => addToRoster(expandedSport)}
                    disabled={!addUserId || saving === "add-roster"}
                  >
                    Add to Roster
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
