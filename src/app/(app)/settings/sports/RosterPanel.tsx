"use client";

import { useCallback, useEffect, useState } from "react";
import { sportLabel } from "@/lib/sports";
import { useToast } from "@/components/Toast";
import type { RosterMember } from "./types";
import { AREA_LABELS } from "./types";

export default function RosterPanel({
  sportCode,
}: {
  sportCode: string;
}) {
  const { toast } = useToast();
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [allUsers, setAllUsers] = useState<{ id: string; name: string; role: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [addUserId, setAddUserId] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  const loadRoster = useCallback(async () => {
    setLoading(true);
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
        setAllUsers(
          json.data?.map((u: { id: string; name: string; role: string }) => ({
            id: u.id,
            name: u.name,
            role: u.role,
          })) ?? []
        );
      }
    } catch {
      toast("Failed to load roster", "error");
    }
    setLoading(false);
  }, [sportCode, toast]);

  useEffect(() => { loadRoster(); }, [loadRoster]);

  async function addToRoster() {
    if (!addUserId) return;
    setSaving("add");
    try {
      const res = await fetch(`/api/sport-configs/${sportCode}/roster`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: addUserId }),
      });
      if (res.ok) {
        setAddUserId("");
        await loadRoster();
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

  async function removeFromRoster(assignmentId: string) {
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

  return (
    <div className="card mt-16">
      <div className="card-header">
        <h2>{sportLabel(sportCode)} Roster</h2>
      </div>
      {loading ? (
        <div className="p-16"><div className="loading-spinner"><div className="spinner" /></div></div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hide-mobile-only">
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
                    <td className="font-medium">{member.user.name}</td>
                    <td>
                      <span className={`badge-sm ${member.user.role === "ADMIN" ? "badge-purple" : member.user.role === "STAFF" ? "badge-blue" : "badge-gray"}`}>
                        {member.user.role.charAt(0) + member.user.role.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td>{member.user.primaryArea ? AREA_LABELS[member.user.primaryArea] : "\u2014"}</td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: "var(--wi-red)" }}
                        onClick={() => removeFromRoster(member.id)}
                        disabled={saving === "remove-" + member.id}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="show-mobile-only">
            {roster.length === 0 && (
              <div className="p-16 text-center text-secondary text-sm">
                No one assigned to this sport yet.
              </div>
            )}
            {roster.map((member) => (
              <div key={member.id} className="roster-mobile-card">
                <div>
                  <span className="font-medium">{member.user.name}</span>
                  <div className="text-xs text-secondary mt-2">
                    <span className={`badge-sm ${member.user.role === "ADMIN" ? "badge-purple" : member.user.role === "STAFF" ? "badge-blue" : "badge-gray"}`}>
                      {member.user.role.charAt(0) + member.user.role.slice(1).toLowerCase()}
                    </span>
                    {member.user.primaryArea && (
                      <span className="ml-8">{AREA_LABELS[member.user.primaryArea]}</span>
                    )}
                  </div>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: "var(--wi-red)" }}
                  onClick={() => removeFromRoster(member.id)}
                  disabled={saving === "remove-" + member.id}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          {/* Add to roster */}
          <div className="p-12 flex gap-8 items-center" style={{ flexWrap: "wrap" }}>
            <select
              className="form-select"
              value={addUserId}
              onChange={(e) => setAddUserId(e.target.value)}
              style={{ minWidth: 200, flex: "1 1 200px" }}
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
              onClick={addToRoster}
              disabled={!addUserId || saving === "add"}
            >
              Add to Roster
            </button>
          </div>
        </>
      )}
    </div>
  );
}
