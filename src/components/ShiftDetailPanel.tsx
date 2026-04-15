"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";
import DataList from "@/components/DataList";
import { formatDateShort, formatTimeShort } from "@/lib/format";
import { sportLabel } from "@/lib/sports";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetBody,
} from "@/components/ui/sheet";
import { handleAuthRedirect, parseErrorMessage } from "@/lib/errors";
import { ShiftAreaSection } from "./shift-detail/ShiftAreaSection";
import type { PickerUser } from "./shift-detail/UserAvatarPicker";

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
  hasConflict: boolean;
  conflictNote: string | null;
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

type Props = {
  groupId: string | null;
  onClose: () => void;
  onUpdated?: () => void;
  currentUserId?: string;
  currentUserRole?: string;
};

const AREAS = ["VIDEO", "PHOTO", "GRAPHICS", "COMMS"] as const;

/* ───── Component ───── */

export default function ShiftDetailPanel({
  groupId,
  onClose,
  onUpdated,
  currentUserId,
  currentUserRole,
}: Props) {
  const confirm = useConfirm();
  const [group, setGroup] = useState<ShiftGroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<false | "network" | "server">(false);
  const [acting, setActing] = useState<string | null>(null);
  const [autoFilling, setAutoFilling] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const usersAbortRef = useRef<AbortController | null>(null);

  // User picker state
  const [pickerShiftId, setPickerShiftId] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<PickerUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [userSearch, setUserSearch] = useState("");

  const isStaff = currentUserRole === "ADMIN" || currentUserRole === "STAFF";

  /* ── Data fetching ── */

  const fetchGroup = useCallback(async () => {
    if (!groupId) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const res = await fetch(`/api/shift-groups/${groupId}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        setGroup((await res.json()).data ?? null);
        setLoadError(false);
      } else {
        setLoadError("server");
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setLoadError("network");
    }
    setLoading(false);
  }, [groupId]);

  useEffect(() => {
    if (groupId) { fetchGroup(); setUsersLoaded(false); }
    else { setGroup(null); }
    return () => { abortRef.current?.abort(); usersAbortRef.current?.abort(); };
  }, [groupId, fetchGroup]);

  const loadUsers = useCallback(async () => {
    if (usersLoaded) return;
    usersAbortRef.current?.abort();
    const controller = new AbortController();
    usersAbortRef.current = controller;
    setUsersLoading(true);
    try {
      const res = await fetch("/api/users?limit=200&active=true", { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        const json = await res.json();
        setAllUsers((json.data ?? json.users ?? []).map((u: Record<string, unknown>) => ({
          id: u.id, name: u.name, role: u.role,
          primaryArea: u.primaryArea ?? null, avatarUrl: u.avatarUrl ?? null,
        })));
        setUsersLoaded(true);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      /* picker shows empty state */
    }
    setUsersLoading(false);
  }, [usersLoaded]);

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

  /* ── Mutation helper ── */

  async function mutate(
    key: string,
    url: string,
    opts: RequestInit,
    successMsg: string,
    preAction?: () => ShiftGroupDetail | null,
  ) {
    setActing(key);
    const prev = preAction?.() ?? null;
    try {
      const res = await fetch(url, opts);
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        toast.success(successMsg);
        await fetchGroup();
        onUpdated?.();
      } else {
        if (prev) setGroup(prev);
        const msg = await parseErrorMessage(res, "Action failed");
        toast.error(msg);
      }
    } catch {
      if (prev) setGroup(prev);
      toast.error("Network error");
    }
    setActing(null);
  }

  /* ── Actions ── */

  function handleAssign(shiftId: string, userId: string) {
    const assignedUser = allUsers.find((u) => u.id === userId);
    setPickerShiftId(null);
    mutate(shiftId, "/api/shift-assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shiftId, userId }),
    }, "Shift assigned", () => {
      const prev = group;
      if (group && assignedUser) {
        setGroup({
          ...group,
          shifts: group.shifts.map((s) =>
            s.id === shiftId ? {
              ...s,
              assignments: [...s.assignments, {
                id: `optimistic-${Date.now()}`, status: "DIRECT_ASSIGNED",
                notes: null, hasConflict: false, conflictNote: null,
                createdAt: new Date().toISOString(),
                user: { ...assignedUser, email: undefined }, assigner: null,
              }],
            } : s
          ),
        });
      }
      return prev;
    });
  }

  const handleApprove = (id: string) =>
    mutate(id, `/api/shift-assignments/${id}/approve`, { method: "PATCH" }, "Request approved");
  const handleDecline = (id: string) =>
    mutate(id, `/api/shift-assignments/${id}/decline`, { method: "PATCH" }, "Request declined");

  async function handleRemove(id: string) {
    const yes = await confirm({ title: "Remove assignment", message: "Remove this shift assignment?", confirmLabel: "Remove", variant: "danger" });
    if (!yes) return;
    mutate(id, `/api/shift-assignments/${id}`, { method: "DELETE" }, "Assignment removed");
  }

  function handleRequest(shiftId: string) {
    mutate(shiftId, "/api/shift-assignments/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shiftId }),
    }, "Shift requested");
  }

  async function handleAutoFill() {
    if (!group) return;
    setAutoFilling(true);
    try {
      const res = await fetch(`/api/shift-groups/${group.id}/auto-assign`, { method: "POST" });
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        const json = await res.json();
        const { assigned, conflicts } = json.data as { assigned: number; conflicts: number; skipped: number };
        if (assigned === 0) {
          toast.info("No eligible workers found for open shifts");
        } else if (conflicts > 0) {
          toast.warning(`${assigned} shift${assigned !== 1 ? "s" : ""} filled — ${conflicts} have schedule conflicts`);
        } else {
          toast.success(`${assigned} shift${assigned !== 1 ? "s" : ""} auto-filled`);
        }
        await fetchGroup();
        onUpdated?.();
      } else {
        const msg = await parseErrorMessage(res, "Auto-fill failed");
        toast.error(msg);
      }
    } catch {
      toast.error("Network error");
    }
    setAutoFilling(false);
  }

  async function handleTogglePremier() {
    if (!group) return;
    mutate("premier", `/api/shift-groups/${group.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPremier: !group.isPremier }),
    }, group.isPremier ? "Removed premier status" : "Marked as premier");
  }

  function handleAddShift(area: string) {
    if (!group) return;
    mutate(`add-${area}`, `/api/shift-groups/${group.id}/shifts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area, workerType: "ST" }),
    }, `Added ${area.charAt(0) + area.slice(1).toLowerCase()} shift`);
  }

  async function handleDeleteShift(shiftId: string, hasAssignment: boolean) {
    if (hasAssignment) {
      const yes = await confirm({ title: "Remove shift", message: "This shift has an assigned worker. Remove it anyway?", confirmLabel: "Remove shift", variant: "danger" });
      if (!yes) return;
    }
    if (!group) return;
    const force = hasAssignment ? "?force=true" : "";
    mutate(`del-${shiftId}`, `/api/shift-groups/${group.id}/shifts/${shiftId}${force}`, { method: "DELETE" }, "Shift removed");
  }

  /* ── Derived data ── */

  const shiftsByArea = useMemo(() => {
    const map: Record<string, Shift[]> = {};
    for (const s of group?.shifts ?? []) {
      if (!map[s.area]) map[s.area] = [];
      map[s.area].push(s);
    }
    return map;
  }, [group?.shifts]);

  /* ── Render ── */

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
            <p className="text-muted-foreground mb-2">
              {loadError === "network"
                ? "Check your connection and try again."
                : "Something went wrong loading shift details."}
            </p>
            <Button variant="outline" size="sm" onClick={fetchGroup}>Retry</Button>
          </div>
        ) : !group ? (
          <div className="p-4 text-muted-foreground">Shift group not found.</div>
        ) : (
          <SheetBody className="px-6 py-4">
            <DataList
              columns={2}
              items={[
                { label: "Date", value: formatDateShort(group.event.startsAt) },
                { label: "Time", value: `${formatTimeShort(group.event.startsAt)} – ${formatTimeShort(group.event.endsAt)}` },
                { label: "Sport", value: group.event.sportCode ? sportLabel(group.event.sportCode) : "—" },
                ...(isStaff ? [{
                  label: "Premier",
                  value: (
                    <Switch
                      checked={group.isPremier}
                      onCheckedChange={handleTogglePremier}
                      disabled={acting !== null}
                      aria-label="Toggle premier status"
                    />
                  ),
                }] : group.isPremier ? [{
                  label: "Premier",
                  value: <Badge variant="blue">Yes</Badge>,
                }] : []),
              ]}
            />

            {isStaff && (
              <div className="flex justify-end mb-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAutoFill}
                  disabled={autoFilling || acting !== null}
                >
                  {autoFilling ? "Filling…" : "Auto-fill"}
                </Button>
              </div>
            )}

            {(AREAS as readonly string[]).map((area) => {
              const shifts = shiftsByArea[area] ?? [];
              if (shifts.length === 0 && !isStaff) return null;
              return (
                <ShiftAreaSection
                  key={area}
                  area={area}
                  shifts={shifts}
                  isStaff={isStaff}
                  isPremier={group.isPremier}
                  currentUserId={currentUserId}
                  acting={acting}
                  pickerShiftId={pickerShiftId}
                  pickerUsers={filteredUsers}
                  pickerLoading={usersLoading}
                  pickerSearch={userSearch}
                  onPickerSearchChange={setUserSearch}
                  onOpenPicker={(shiftId) => { setPickerShiftId(shiftId); setUserSearch(""); loadUsers(); }}
                  onClosePicker={() => setPickerShiftId(null)}
                  onAddShift={() => handleAddShift(area)}
                  onDeleteShift={handleDeleteShift}
                  onAssign={handleAssign}
                  onRemove={handleRemove}
                  onApprove={handleApprove}
                  onDecline={handleDecline}
                  onRequest={handleRequest}
                />
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
