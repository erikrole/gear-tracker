"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import DataList from "@/components/DataList";
import { formatDateShort, formatTimeShort } from "@/lib/format";
import { sportLabel } from "@/lib/sports";

/* ───── Types ───── */

type ShiftUser = {
  id: string;
  name: string;
  email?: string;
  role?: string;
  primaryArea: string | null;
};

type ShiftAssignment = {
  id: string;
  status: string;
  notes: string | null;
  createdAt: string;
  user: ShiftUser;
  assigner?: { id: string; name: string } | null;
};

type Shift = {
  id: string;
  area: string;
  workerType: string;
  startsAt: string;
  endsAt: string;
  notes: string | null;
  assignments: ShiftAssignment[];
};

type ShiftGroupDetail = {
  id: string;
  eventId: string;
  isPremier: boolean;
  notes: string | null;
  event: {
    id: string;
    summary: string;
    startsAt: string;
    endsAt: string;
    sportCode: string | null;
    isHome: boolean | null;
    opponent: string | null;
  };
  shifts: Shift[];
};

type RosterUser = {
  id: string;
  name: string;
  role: string;
  primaryArea: string | null;
};

type Props = {
  groupId: string | null;
  onClose: () => void;
  onUpdated?: () => void;
  currentUserId?: string;
  currentUserRole?: string;
};

const AREA_LABELS: Record<string, string> = {
  VIDEO: "Video",
  PHOTO: "Photo",
  GRAPHICS: "Graphics",
  COMMS: "Comms",
};

const WORKER_LABELS: Record<string, string> = {
  FT: "Full-time",
  ST: "Student",
};

const STATUS_BADGES: Record<string, string> = {
  DIRECT_ASSIGNED: "badge-blue",
  REQUESTED: "badge-orange",
  APPROVED: "badge-green",
  DECLINED: "badge-red",
  SWAPPED: "badge-gray",
};

/* ───── Component ───── */

export default function ShiftDetailPanel({
  groupId,
  onClose,
  onUpdated,
  currentUserId,
  currentUserRole,
}: Props) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [group, setGroup] = useState<ShiftGroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  // User picker for assignments
  const [assigningShiftId, setAssigningShiftId] = useState<string | null>(null);
  const [rosterUsers, setRosterUsers] = useState<RosterUser[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");

  const isStaff = currentUserRole === "ADMIN" || currentUserRole === "STAFF";

  const fetchGroup = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/shift-groups/${groupId}`);
      if (res.ok) {
        const json = await res.json();
        setGroup(json.data ?? null);
      }
    } catch { /* network error */ }
    setLoading(false);
  }, [groupId]);

  useEffect(() => {
    if (groupId) {
      fetchGroup();
    } else {
      setGroup(null);
    }
  }, [groupId, fetchGroup]);

  // Load roster users for assignment picker
  const loadRoster = useCallback(async (sportCode: string) => {
    setRosterLoading(true);
    try {
      const res = await fetch(`/api/sport-configs/${sportCode}/roster`);
      if (res.ok) {
        const json = await res.json();
        setRosterUsers(json.data ?? []);
      }
    } catch { /* network error */ }
    setRosterLoading(false);
  }, []);

  function openAssignPicker(shiftId: string) {
    setAssigningShiftId(shiftId);
    setUserSearch("");
    if (group?.event.sportCode) {
      loadRoster(group.event.sportCode);
    }
  }

  async function handleAssign(shiftId: string, userId: string) {
    setActing(shiftId);
    try {
      const res = await fetch("/api/shift-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shiftId, userId }),
      });
      if (res.ok) {
        toast("Shift assigned", "success");
        setAssigningShiftId(null);
        await fetchGroup();
        onUpdated?.();
      } else {
        const json = await res.json().catch(() => ({}));
        toast((json as Record<string, string>).error || "Failed to assign", "error");
      }
    } catch { toast("Network error", "error"); }
    setActing(null);
  }

  async function handleApprove(assignmentId: string) {
    setActing(assignmentId);
    try {
      const res = await fetch(`/api/shift-assignments/${assignmentId}/approve`, { method: "PATCH" });
      if (res.ok) {
        toast("Request approved", "success");
        await fetchGroup();
        onUpdated?.();
      } else {
        const json = await res.json().catch(() => ({}));
        toast((json as Record<string, string>).error || "Failed to approve", "error");
      }
    } catch { toast("Network error", "error"); }
    setActing(null);
  }

  async function handleDecline(assignmentId: string) {
    setActing(assignmentId);
    try {
      const res = await fetch(`/api/shift-assignments/${assignmentId}/decline`, { method: "PATCH" });
      if (res.ok) {
        toast("Request declined", "success");
        await fetchGroup();
        onUpdated?.();
      } else {
        const json = await res.json().catch(() => ({}));
        toast((json as Record<string, string>).error || "Failed to decline", "error");
      }
    } catch { toast("Network error", "error"); }
    setActing(null);
  }

  async function handleRemove(assignmentId: string) {
    const ok = await confirm({
      title: "Remove assignment",
      message: "Remove this shift assignment?",
      confirmLabel: "Remove",
      variant: "danger",
    });
    if (!ok) return;
    setActing(assignmentId);
    try {
      const res = await fetch(`/api/shift-assignments/${assignmentId}`, { method: "DELETE" });
      if (res.ok) {
        toast("Assignment removed", "success");
        await fetchGroup();
        onUpdated?.();
      } else {
        const json = await res.json().catch(() => ({}));
        toast((json as Record<string, string>).error || "Failed to remove", "error");
      }
    } catch { toast("Network error", "error"); }
    setActing(null);
  }

  async function handleRequest(shiftId: string) {
    setActing(shiftId);
    try {
      const res = await fetch("/api/shift-assignments/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shiftId }),
      });
      if (res.ok) {
        toast("Shift requested", "success");
        await fetchGroup();
        onUpdated?.();
      } else {
        const json = await res.json().catch(() => ({}));
        toast((json as Record<string, string>).error || "Failed to request", "error");
      }
    } catch { toast("Network error", "error"); }
    setActing(null);
  }

  async function handleTogglePremier() {
    if (!group) return;
    setActing("premier");
    try {
      const res = await fetch(`/api/shift-groups/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPremier: !group.isPremier }),
      });
      if (res.ok) {
        toast(group.isPremier ? "Removed premier status" : "Marked as premier", "success");
        await fetchGroup();
        onUpdated?.();
      } else {
        const json = await res.json().catch(() => ({}));
        toast((json as Record<string, string>).error || "Failed to update", "error");
      }
    } catch { toast("Network error", "error"); }
    setActing(null);
  }

  if (!groupId) return null;

  // Group shifts by area
  const shiftsByArea = (group?.shifts ?? []).reduce<Record<string, Shift[]>>((acc, s) => {
    const key = s.area;
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  const filteredRoster = rosterUsers.filter((u) => {
    if (!userSearch) return true;
    return u.name.toLowerCase().includes(userSearch.toLowerCase());
  });

  return (
    <div className="sheet-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet-panel">
        <div className="sheet-header">
          <h2>{group?.event.summary ?? "Loading..."}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>

        {loading ? (
          <div className="p-16 text-secondary">Loading shift details...</div>
        ) : !group ? (
          <div className="p-16 text-secondary">Shift group not found.</div>
        ) : (
          <div className="sheet-body">
            {/* Event info */}
            <DataList
              columns={2}
              items={[
                { label: "Date", value: formatDateShort(group.event.startsAt) },
                { label: "Time", value: `${formatTimeShort(group.event.startsAt)} – ${formatTimeShort(group.event.endsAt)}` },
                { label: "Sport", value: group.event.sportCode ? sportLabel(group.event.sportCode) : "—" },
                {
                  label: "Premier",
                  value: (
                    <span className="flex-center gap-4">
                      <span className={`badge ${group.isPremier ? "badge-blue" : "badge-gray"}`}>
                        {group.isPremier ? "Yes" : "No"}
                      </span>
                      {isStaff && (
                        <button
                          className="btn btn-sm"
                          onClick={handleTogglePremier}
                          disabled={acting === "premier"}
                          style={{ fontSize: 11, padding: "2px 6px" }}
                        >
                          {acting === "premier" ? "..." : "Toggle"}
                        </button>
                      )}
                    </span>
                  ),
                },
              ]}
            />

            {/* Shifts by area */}
            {Object.entries(shiftsByArea).map(([area, shifts]) => (
              <div key={area} className="mt-16">
                <h3 className="text-sm font-semibold mb-8" style={{ color: "var(--text-secondary)" }}>
                  {AREA_LABELS[area] ?? area}
                </h3>
                {shifts.map((shift) => {
                  const activeAssignment = shift.assignments.find(
                    (a) => a.status === "DIRECT_ASSIGNED" || a.status === "APPROVED"
                  );
                  const pendingRequests = shift.assignments.filter(
                    (a) => a.status === "REQUESTED"
                  );
                  const isAssigned = !!activeAssignment;
                  const userHasRequested = pendingRequests.some(
                    (a) => a.user.id === currentUserId
                  );

                  return (
                    <div
                      key={shift.id}
                      className="p-12 mb-8 rounded"
                      style={{
                        border: "1px solid var(--border-light)",
                        background: isAssigned
                          ? "var(--bg-success-subtle, rgba(34,197,94,0.05))"
                          : "var(--bg-surface, var(--bg-card))",
                      }}
                    >
                      <div className="flex-between mb-4">
                        <span className="text-sm font-semibold">
                          {WORKER_LABELS[shift.workerType] ?? shift.workerType}
                        </span>
                        {isAssigned ? (
                          <span className="badge badge-green">Filled</span>
                        ) : pendingRequests.length > 0 ? (
                          <span className="badge badge-orange">
                            {pendingRequests.length} request{pendingRequests.length > 1 ? "s" : ""}
                          </span>
                        ) : (
                          <span className="badge badge-red">Open</span>
                        )}
                      </div>

                      {/* Active assignment */}
                      {activeAssignment && (
                        <div className="flex-between">
                          <span className="text-sm">{activeAssignment.user.name}</span>
                          <div className="flex gap-4">
                            <span className={`badge ${STATUS_BADGES[activeAssignment.status] ?? "badge-gray"}`} style={{ fontSize: 10 }}>
                              {activeAssignment.status.replace("_", " ")}
                            </span>
                            {isStaff && (
                              <button
                                className="btn btn-sm text-red"
                                onClick={() => handleRemove(activeAssignment.id)}
                                disabled={acting === activeAssignment.id}
                                style={{ fontSize: 11, padding: "2px 6px" }}
                              >
                                {acting === activeAssignment.id ? "..." : "Remove"}
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Pending requests */}
                      {pendingRequests.length > 0 && (
                        <div className="mt-8">
                          {pendingRequests.map((req) => (
                            <div key={req.id} className="flex-between mb-4">
                              <span className="text-sm text-secondary">{req.user.name}</span>
                              {isStaff && (
                                <div className="flex gap-4">
                                  <button
                                    className="btn btn-sm btn-primary"
                                    onClick={() => handleApprove(req.id)}
                                    disabled={acting === req.id}
                                    style={{ fontSize: 11, padding: "2px 6px" }}
                                  >
                                    {acting === req.id ? "..." : "Approve"}
                                  </button>
                                  <button
                                    className="btn btn-sm text-red"
                                    onClick={() => handleDecline(req.id)}
                                    disabled={acting === req.id}
                                    style={{ fontSize: 11, padding: "2px 6px" }}
                                  >
                                    Decline
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Actions */}
                      {!isAssigned && (
                        <div className="flex gap-4 mt-8">
                          {isStaff && (
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => openAssignPicker(shift.id)}
                              style={{ fontSize: 11 }}
                            >
                              Assign
                            </button>
                          )}
                          {!isStaff && group.isPremier && !userHasRequested && (
                            <button
                              className="btn btn-sm"
                              onClick={() => handleRequest(shift.id)}
                              disabled={acting === shift.id}
                              style={{ fontSize: 11 }}
                            >
                              {acting === shift.id ? "Requesting..." : "Request this shift"}
                            </button>
                          )}
                          {userHasRequested && (
                            <span className="text-xs text-secondary">You have requested this shift</span>
                          )}
                        </div>
                      )}

                      {/* Inline user picker for staff assignment */}
                      {assigningShiftId === shift.id && (
                        <div className="mt-8 p-8 rounded" style={{ border: "1px solid var(--border)", background: "var(--bg-card)" }}>
                          <input
                            type="text"
                            className="form-input mb-8"
                            placeholder="Search roster..."
                            value={userSearch}
                            onChange={(e) => setUserSearch(e.target.value)}
                            autoFocus
                            style={{ fontSize: 12 }}
                          />
                          {rosterLoading ? (
                            <div className="text-xs text-secondary">Loading roster...</div>
                          ) : filteredRoster.length === 0 ? (
                            <div className="text-xs text-secondary">
                              {rosterUsers.length === 0
                                ? "No users assigned to this sport. Add users in Settings → Sports."
                                : "No matching users."}
                            </div>
                          ) : (
                            <div style={{ maxHeight: 200, overflowY: "auto" }}>
                              {filteredRoster.map((u) => (
                                <button
                                  key={u.id}
                                  className="btn btn-sm w-full text-left mb-2"
                                  onClick={() => handleAssign(shift.id, u.id)}
                                  disabled={acting === shift.id}
                                  style={{ fontSize: 12, justifyContent: "flex-start" }}
                                >
                                  {u.name}
                                  <span className="text-xs text-secondary ml-4">
                                    {u.role === "STUDENT" ? "ST" : "FT"}
                                    {u.primaryArea ? ` · ${AREA_LABELS[u.primaryArea] ?? u.primaryArea}` : ""}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                          <button
                            className="btn btn-sm mt-4"
                            onClick={() => setAssigningShiftId(null)}
                            style={{ fontSize: 11 }}
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            {group.notes && (
              <div className="mt-16 p-12 rounded text-sm" style={{ background: "var(--bg-surface)" }}>
                <strong>Notes:</strong> {group.notes}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
