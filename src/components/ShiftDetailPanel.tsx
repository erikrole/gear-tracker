"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import DataList from "@/components/DataList";
import { formatDateShort, formatTimeShort } from "@/lib/format";
import { sportLabel } from "@/lib/sports";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetBody,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PlusIcon, XIcon, ArrowRightLeftIcon } from "lucide-react";

/* ───── Types ───── */

type ShiftUser = {
  id: string;
  name: string;
  email?: string;
  role?: string;
  primaryArea: string | null;
  avatarUrl?: string | null;
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
  manuallyEdited?: boolean;
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

type PickerUser = {
  id: string;
  name: string;
  role: string;
  primaryArea: string | null;
  avatarUrl?: string | null;
};

type Props = {
  groupId: string | null;
  onClose: () => void;
  onUpdated?: () => void;
  currentUserId?: string;
  currentUserRole?: string;
};

const AREAS = ["VIDEO", "PHOTO", "GRAPHICS", "COMMS"] as const;

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
  DIRECT_ASSIGNED: "blue",
  REQUESTED: "orange",
  APPROVED: "green",
  DECLINED: "red",
  SWAPPED: "gray",
};

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

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
  const [loadError, setLoadError] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  // Universal user picker
  const [pickerShiftId, setPickerShiftId] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<PickerUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [userSearch, setUserSearch] = useState("");

  const isStaff = currentUserRole === "ADMIN" || currentUserRole === "STAFF";

  function redirectOn401(res: Response): boolean {
    if (res.status === 401) { window.location.href = "/login"; return true; }
    return false;
  }

  const fetchGroup = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/shift-groups/${groupId}`);
      if (res.status === 401) { window.location.href = "/login"; return; }
      if (res.ok) {
        const json = await res.json();
        setGroup(json.data ?? null);
        setLoadError(false);
      } else {
        setLoadError(true);
      }
    } catch {
      setLoadError(true);
    }
    setLoading(false);
  }, [groupId]);

  useEffect(() => {
    if (groupId) {
      fetchGroup();
      setUsersLoaded(false);
    } else {
      setGroup(null);
    }
  }, [groupId, fetchGroup]);

  // Load all active users (universal — not roster-restricted)
  const loadUsers = useCallback(async () => {
    if (usersLoaded) return;
    setUsersLoading(true);
    try {
      const res = await fetch("/api/users?limit=200&active=true");
      if (redirectOn401(res)) return;
      if (res.ok) {
        const json = await res.json();
        const users: PickerUser[] = (json.data ?? json.users ?? []).map((u: Record<string, unknown>) => ({
          id: u.id,
          name: u.name,
          role: u.role,
          primaryArea: u.primaryArea ?? null,
          avatarUrl: u.avatarUrl ?? null,
        }));
        setAllUsers(users);
        setUsersLoaded(true);
      }
    } catch { /* silent */ }
    setUsersLoading(false);
  }, [usersLoaded]);

  function openPicker(shiftId: string) {
    setPickerShiftId(shiftId);
    setUserSearch("");
    loadUsers();
  }

  // Filter out users already assigned to this shift
  const filteredUsers = useMemo(() => {
    if (!group || !pickerShiftId) return allUsers;
    const shift = group.shifts.find((s) => s.id === pickerShiftId);
    const assignedIds = new Set(
      (shift?.assignments ?? [])
        .filter((a) => a.status === "DIRECT_ASSIGNED" || a.status === "APPROVED")
        .map((a) => a.user.id)
    );
    let users = allUsers.filter((u) => !assignedIds.has(u.id));
    if (userSearch) {
      const q = userSearch.toLowerCase();
      users = users.filter((u) => u.name.toLowerCase().includes(q));
    }
    return users;
  }, [allUsers, group, pickerShiftId, userSearch]);

  /* ── Actions ── */

  async function handleAssign(shiftId: string, userId: string) {
    setActing(shiftId);
    try {
      const res = await fetch("/api/shift-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shiftId, userId }),
      });
      if (redirectOn401(res)) return;
      if (res.ok) {
        toast("Shift assigned", "success");
        setPickerShiftId(null);
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
      if (redirectOn401(res)) return;
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
      if (redirectOn401(res)) return;
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
    const yes = await confirm({
      title: "Remove assignment",
      message: "Remove this shift assignment?",
      confirmLabel: "Remove",
      variant: "danger",
    });
    if (!yes) return;
    setActing(assignmentId);
    try {
      const res = await fetch(`/api/shift-assignments/${assignmentId}`, { method: "DELETE" });
      if (redirectOn401(res)) return;
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
      if (redirectOn401(res)) return;
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
      if (redirectOn401(res)) return;
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

  async function handleAddShift(area: string) {
    if (!group) return;
    setActing(`add-${area}`);
    try {
      const res = await fetch(`/api/shift-groups/${group.id}/shifts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area, workerType: "ST" }),
      });
      if (redirectOn401(res)) return;
      if (res.ok) {
        toast(`Added ${AREA_LABELS[area] ?? area} shift`, "success");
        await fetchGroup();
        onUpdated?.();
      } else {
        const json = await res.json().catch(() => ({}));
        toast((json as Record<string, string>).error || "Failed to add shift", "error");
      }
    } catch { toast("Network error", "error"); }
    setActing(null);
  }

  async function handleDeleteShift(shiftId: string, hasAssignment: boolean) {
    if (hasAssignment) {
      const yes = await confirm({
        title: "Remove shift",
        message: "This shift has an assigned worker. Remove it anyway?",
        confirmLabel: "Remove shift",
        variant: "danger",
      });
      if (!yes) return;
    }
    if (!group) return;
    setActing(`del-${shiftId}`);
    try {
      const force = hasAssignment ? "?force=true" : "";
      const res = await fetch(`/api/shift-groups/${group.id}/shifts/${shiftId}${force}`, {
        method: "DELETE",
      });
      if (redirectOn401(res)) return;
      if (res.ok) {
        toast("Shift removed", "success");
        await fetchGroup();
        onUpdated?.();
      } else {
        const json = await res.json().catch(() => ({}));
        toast((json as Record<string, string>).error || "Failed to remove shift", "error");
      }
    } catch { toast("Network error", "error"); }
    setActing(null);
  }

  // Group shifts by area
  const shiftsByArea = useMemo(() => {
    const map: Record<string, Shift[]> = {};
    for (const s of group?.shifts ?? []) {
      if (!map[s.area]) map[s.area] = [];
      map[s.area].push(s);
    }
    return map;
  }, [group?.shifts]);

  // Areas present + remaining areas for the add button
  const presentAreas = Object.keys(shiftsByArea);
  const allAreas = AREAS as readonly string[];

  return (
    <Sheet open={!!groupId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{group?.event.summary ?? "Loading..."}</SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="p-4 text-muted-foreground">Loading shift details...</div>
        ) : loadError ? (
          <div className="p-4 text-center">
            <p className="text-muted-foreground mb-2">Failed to load shift details.</p>
            <Button variant="outline" size="sm" onClick={fetchGroup}>Retry</Button>
          </div>
        ) : !group ? (
          <div className="p-4 text-muted-foreground">Shift group not found.</div>
        ) : (
          <SheetBody className="px-6 py-4">
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
                    <span className="flex items-center gap-1">
                      <Badge variant={group.isPremier ? "blue" : "gray"}>
                        {group.isPremier ? "Yes" : "No"}
                      </Badge>
                      {isStaff && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-5 px-1.5 text-[10px]"
                          onClick={handleTogglePremier}
                          disabled={acting !== null}
                        >
                          {acting === "premier" ? "..." : "Toggle"}
                        </Button>
                      )}
                    </span>
                  ),
                },
              ]}
            />

            {/* Shifts by area */}
            {allAreas.map((area) => {
              const shifts = shiftsByArea[area] ?? [];
              if (shifts.length === 0 && !isStaff) return null;

              return (
                <div key={area} className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-muted-foreground">
                      {AREA_LABELS[area] ?? area}
                      {shifts.length > 0 && (
                        <span className="ml-1.5 text-xs font-normal">({shifts.length})</span>
                      )}
                    </h3>
                    {isStaff && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 text-xs text-muted-foreground"
                        onClick={() => handleAddShift(area)}
                        disabled={acting !== null}
                        title={`Add ${AREA_LABELS[area]} shift`}
                      >
                        <PlusIcon className="size-3.5 mr-0.5" />
                        Shift
                      </Button>
                    )}
                  </div>

                  {shifts.length === 0 ? (
                    <p className="text-xs text-muted-foreground mb-2">No shifts configured</p>
                  ) : (
                    shifts.map((shift) => {
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
                          className={`p-3 mb-2 rounded-md border ${isAssigned ? "border-green-200 bg-green-50/50 dark:border-green-900/30 dark:bg-green-950/20" : "border-border bg-card"}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">
                              {WORKER_LABELS[shift.workerType] ?? shift.workerType}
                            </span>
                            <div className="flex items-center gap-1">
                              {isAssigned ? (
                                <Badge variant="green" size="sm">Filled</Badge>
                              ) : pendingRequests.length > 0 ? (
                                <Badge variant="orange" size="sm">
                                  {pendingRequests.length} request{pendingRequests.length > 1 ? "s" : ""}
                                </Badge>
                              ) : (
                                <Badge variant="red" size="sm">Open</Badge>
                              )}
                              {isStaff && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                                  onClick={() => handleDeleteShift(shift.id, isAssigned)}
                                  disabled={acting !== null}
                                  title="Remove shift"
                                >
                                  <XIcon className="size-3" />
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Active assignment — avatar display */}
                          {activeAssignment && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm flex items-center gap-2">
                                <Avatar className="size-7">
                                  {activeAssignment.user.avatarUrl && (
                                    <AvatarImage src={activeAssignment.user.avatarUrl} alt={activeAssignment.user.name} />
                                  )}
                                  <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-medium">
                                    {initials(activeAssignment.user.name)}
                                  </AvatarFallback>
                                </Avatar>
                                {activeAssignment.user.name}
                              </span>
                              <div className="flex items-center gap-1">
                                <Badge variant={(STATUS_BADGES[activeAssignment.status] ?? "gray") as BadgeProps["variant"]} size="sm">
                                  {activeAssignment.status.replace("_", " ")}
                                </Badge>
                                {isStaff && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-5 px-1 text-[10px] text-destructive"
                                      onClick={() => handleRemove(activeAssignment.id)}
                                      disabled={acting !== null}
                                    >
                                      {acting === activeAssignment.id ? "..." : "Remove"}
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Pending requests */}
                          {pendingRequests.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {pendingRequests.map((req) => (
                                <div key={req.id} className="flex items-center justify-between">
                                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                                    <Avatar className="size-6">
                                      <AvatarFallback className="bg-muted text-muted-foreground text-xs font-medium">
                                        {initials(req.user.name)}
                                      </AvatarFallback>
                                    </Avatar>
                                    {req.user.name}
                                  </span>
                                  {isStaff && (
                                    <div className="flex gap-1">
                                      <Button
                                        size="sm"
                                        className="h-5 px-1.5 text-[10px]"
                                        onClick={() => handleApprove(req.id)}
                                        disabled={acting !== null}
                                      >
                                        {acting === req.id ? "..." : "Approve"}
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 px-1.5 text-[10px] text-destructive"
                                        onClick={() => handleDecline(req.id)}
                                        disabled={acting !== null}
                                      >
                                        Decline
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Assignment actions */}
                          {!isAssigned && (
                            <div className="flex items-center gap-1 mt-2">
                              {isStaff && (
                                <Popover
                                  open={pickerShiftId === shift.id}
                                  onOpenChange={(open) => {
                                    if (open) openPicker(shift.id);
                                    else setPickerShiftId(null);
                                  }}
                                >
                                  <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                                      <PlusIcon className="size-3" />
                                      Assign
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-64 p-2" align="start">
                                    <Input
                                      type="text"
                                      className="mb-2 h-8 text-xs"
                                      placeholder="Search all users..."
                                      value={userSearch}
                                      onChange={(e) => setUserSearch(e.target.value)}
                                      autoFocus
                                    />
                                    {usersLoading ? (
                                      <p className="text-xs text-muted-foreground p-2">Loading users...</p>
                                    ) : filteredUsers.length === 0 ? (
                                      <p className="text-xs text-muted-foreground p-2">
                                        {allUsers.length === 0 ? "No active users found." : "No matching users."}
                                      </p>
                                    ) : (
                                      <div className="max-h-52 overflow-y-auto space-y-0.5">
                                        {filteredUsers.map((u) => (
                                          <button
                                            key={u.id}
                                            className="w-full flex items-center gap-2 p-1.5 rounded-md text-left text-sm hover:bg-accent transition-colors disabled:opacity-50"
                                            onClick={() => handleAssign(shift.id, u.id)}
                                            disabled={acting !== null}
                                          >
                                            <Avatar className="size-7 shrink-0">
                                              {u.avatarUrl && <AvatarImage src={u.avatarUrl} alt={u.name} />}
                                              <AvatarFallback className="bg-muted text-muted-foreground text-xs font-medium">
                                                {initials(u.name)}
                                              </AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0">
                                              <div className="truncate font-medium text-xs">{u.name}</div>
                                              <div className="text-[10px] text-muted-foreground">
                                                {u.role === "STUDENT" ? "Student" : "Staff"}
                                                {u.primaryArea ? ` · ${AREA_LABELS[u.primaryArea] ?? u.primaryArea}` : ""}
                                              </div>
                                            </div>
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </PopoverContent>
                                </Popover>
                              )}
                              {!isStaff && group.isPremier && !userHasRequested && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => handleRequest(shift.id)}
                                  disabled={acting !== null}
                                >
                                  {acting === shift.id ? "Requesting..." : "Request this shift"}
                                </Button>
                              )}
                              {userHasRequested && (
                                <span className="text-xs text-muted-foreground">You have requested this shift</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })}

            {group.notes && (
              <div className="mt-4 p-3 rounded-md bg-muted/50 text-sm">
                <strong>Notes:</strong> {group.notes}
              </div>
            )}
          </SheetBody>
        )}
      </SheetContent>
    </Sheet>
  );
}
