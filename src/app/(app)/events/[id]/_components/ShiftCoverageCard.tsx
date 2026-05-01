"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { PlusIcon, XIcon } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { formatTimeShort } from "@/lib/format";
import { handleAuthRedirect, parseErrorMessage } from "@/lib/errors";
import { UserAvatarPicker, type PickerUser } from "@/components/shift-detail/UserAvatarPicker";
import type { ShiftGroupSummary, CommandCenterData } from "../_utils";
import { AREA_LABELS } from "../_utils";

const AREAS = ["VIDEO", "PHOTO", "GRAPHICS", "COMMS"] as const;

type Shift = ShiftGroupSummary["shifts"][number];
type Assignment = Shift["assignments"][number];

type Props = {
  shiftGroup: ShiftGroupSummary;
  commandCenter: CommandCenterData | null;
  currentUserRole: string;
  acting: string | null;
  linkParams: {
    titleParam: string;
    dateParam: string;
    endParam: string;
    locationParam: string;
    eventParam: string;
  };
  onNudge: (assignmentId: string, userName: string) => void;
  onUpdated?: () => void;
};

export function ShiftCoverageCard({
  shiftGroup,
  commandCenter,
  currentUserRole,
  acting,
  linkParams,
  onNudge,
  onUpdated,
}: Props) {
  const { titleParam, dateParam, endParam, locationParam, eventParam } = linkParams;
  const isStaffOrAdmin = currentUserRole === "STAFF" || currentUserRole === "ADMIN";
  const groupId = shiftGroup.id;

  // ── User picker ──
  const [pickerShiftId, setPickerShiftId] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<PickerUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const usersAbortRef = useRef<AbortController | null>(null);

  // ── Local acting state for all mutations ──
  const [inlineActing, setInlineActing] = useState<string | null>(null);
  const [autoFilling, setAutoFilling] = useState(false);

  // ── Delete confirmation ──
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // ── Pending requests popover ──
  const [requestsShiftId, setRequestsShiftId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    if (usersLoaded) return;
    usersAbortRef.current?.abort();
    const ctrl = new AbortController();
    usersAbortRef.current = ctrl;
    setUsersLoading(true);
    try {
      const res = await fetch("/api/users?limit=200&active=true", { signal: ctrl.signal });
      if (ctrl.signal.aborted) return;
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
    }
    setUsersLoading(false);
  }, [usersLoaded]);

  const filteredUsers = useMemo(() => {
    if (!userSearch) return allUsers;
    const q = userSearch.toLowerCase();
    return allUsers.filter((u) => u.name.toLowerCase().includes(q));
  }, [allUsers, userSearch]);

  // ── Derived data ──

  const shiftsByArea = useMemo(() => {
    const map: Record<string, Shift[]> = {};
    for (const s of shiftGroup.shifts) {
      if (!map[s.area]) map[s.area] = [];
      map[s.area].push(s);
    }
    return map;
  }, [shiftGroup.shifts]);

  // Gear status from commandCenter keyed by shift ID
  type CenterShift = NonNullable<typeof commandCenter>["shifts"][number];
  const gearMap = useMemo(() => {
    if (!commandCenter) return new Map<string, CenterShift>();
    return new Map(commandCenter.shifts.map((cs) => [cs.id, cs]));
  }, [commandCenter]);

  const coverage = shiftGroup.coverage;
  const coverageVariant = !coverage ? "gray"
    : coverage.percentage >= 100 ? "green"
    : coverage.percentage > 0 ? "orange"
    : "red";

  // ── Mutations ──

  async function mutate(key: string, url: string, opts: RequestInit, successMsg: string) {
    setInlineActing(key);
    try {
      const res = await fetch(url, opts);
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        toast.success(successMsg);
        onUpdated?.();
      } else {
        const msg = await parseErrorMessage(res, "Action failed");
        toast.error(msg);
      }
    } catch {
      toast.error("Network error");
    }
    setInlineActing(null);
  }

  function handleAssign(shiftId: string, userId: string) {
    setPickerShiftId(null);
    mutate(shiftId, "/api/shift-assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shiftId, userId }),
    }, "Shift assigned");
  }

  function handleRemove(assignmentId: string) {
    mutate(assignmentId, `/api/shift-assignments/${assignmentId}`, { method: "DELETE" }, "Assignment removed");
  }

  function handleAddShift(area: string, workerType: string) {
    const label = workerType === "FT" ? "Staff" : "Student";
    mutate(`add-${area}-${workerType}`, `/api/shift-groups/${groupId}/shifts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area, workerType }),
    }, `${AREA_LABELS[area] ?? area} ${label} shift added`);
  }

  function handleDeleteShift(shiftId: string, force: boolean) {
    setDeleteConfirmId(null);
    mutate(`del-${shiftId}`, `/api/shift-groups/${groupId}/shifts/${shiftId}${force ? "?force=true" : ""}`, { method: "DELETE" }, "Shift removed");
  }

  function handleApprove(assignmentId: string) {
    setRequestsShiftId(null);
    mutate(assignmentId, `/api/shift-assignments/${assignmentId}/approve`, { method: "PATCH" }, "Request approved");
  }

  function handleDecline(assignmentId: string) {
    setRequestsShiftId(null);
    mutate(assignmentId, `/api/shift-assignments/${assignmentId}/decline`, { method: "PATCH" }, "Request declined");
  }

  async function handleAutoFill() {
    setAutoFilling(true);
    try {
      const res = await fetch(`/api/shift-groups/${groupId}/auto-assign`, { method: "POST" });
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        const json = await res.json();
        const { assigned, conflicts } = json.data as { assigned: number; conflicts: number; skipped: number };
        if (assigned === 0) toast.info("No eligible workers found");
        else if (conflicts > 0) toast.warning(`${assigned} filled — ${conflicts} have conflicts`);
        else toast.success(`${assigned} shift${assigned !== 1 ? "s" : ""} auto-filled`);
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

  // ── Sub-components ──

  function AssignCell({ shift, activeAssignment }: { shift: Shift; activeAssignment: Assignment | null }) {
    const isActing = inlineActing === shift.id || inlineActing === (activeAssignment?.id ?? "");

    if (activeAssignment) {
      return (
        <span className="flex items-center gap-2 group">
          <UserAvatar
            name={activeAssignment.user.name}
            avatarUrl={activeAssignment.user.avatarUrl}
            size="sm"
          />
          <span className="text-sm">{activeAssignment.user.name}</span>
          {isStaffOrAdmin && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleRemove(activeAssignment.id)}
                  disabled={isActing || inlineActing !== null}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  aria-label="Remove assignment"
                >
                  <XIcon className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Remove assignment</TooltipContent>
            </Tooltip>
          )}
        </span>
      );
    }

    if (!isStaffOrAdmin) return <span className="text-muted-foreground">&mdash;</span>;

    return (
      <Popover
        open={pickerShiftId === shift.id}
        onOpenChange={(open) => {
          if (open) { setPickerShiftId(shift.id); setUserSearch(""); loadUsers(); }
          else setPickerShiftId(null);
        }}
      >
        <PopoverTrigger asChild>
          <button
            className="group flex items-center gap-1.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors text-sm disabled:pointer-events-none"
            disabled={isActing || inlineActing !== null}
          >
            {isActing ? <span className="text-xs">Assigning…</span> : (
              <>
                <div className="size-6 rounded-full border-2 border-dashed border-muted-foreground/20 group-hover:border-primary/40 flex items-center justify-center transition-colors">
                  <PlusIcon className="size-3 text-muted-foreground/30 group-hover:text-primary/60 transition-colors" />
                </div>
                <span className="group-hover:text-muted-foreground/80">Assign</span>
              </>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <UserAvatarPicker
            users={filteredUsers}
            loading={usersLoading}
            search={userSearch}
            onSearchChange={setUserSearch}
            onSelect={(userId) => handleAssign(shift.id, userId)}
            disabled={inlineActing !== null}
          />
        </PopoverContent>
      </Popover>
    );
  }

  function StatusCell({ shift, activeAssignment, pendingRequests }: {
    shift: Shift;
    activeAssignment: Assignment | null;
    pendingRequests: Assignment[];
  }) {
    if (pendingRequests.length > 0 && isStaffOrAdmin) {
      return (
        <Popover open={requestsShiftId === shift.id} onOpenChange={(open) => setRequestsShiftId(open ? shift.id : null)}>
          <PopoverTrigger asChild>
            <button>
              <Badge variant="orange" className="cursor-pointer">
                {pendingRequests.length} req
              </Badge>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="start">
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Pending requests</p>
            <div className="flex flex-col gap-2">
              {pendingRequests.map((req) => (
                <div key={req.id} className="flex items-center justify-between gap-2">
                  <span className="text-sm truncate">{req.user.name}</span>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" className="h-6 px-2 text-xs" onClick={() => handleApprove(req.id)} disabled={inlineActing !== null}>
                      {inlineActing === req.id ? "…" : "Approve"}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-destructive" onClick={() => handleDecline(req.id)} disabled={inlineActing !== null}>
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      );
    }

    if (activeAssignment) return <Badge variant="green">Filled</Badge>;
    if (pendingRequests.length > 0) return <Badge variant="orange">{pendingRequests.length} req</Badge>;
    return <Badge variant="red">Open</Badge>;
  }

  function GearCell({ shiftId, hasAssignment }: { shiftId: string; hasAssignment: boolean }) {
    if (!commandCenter || !hasAssignment) return <span className="text-muted-foreground">&mdash;</span>;
    const cs = gearMap.get(shiftId);
    if (!cs?.assignment) return <span className="text-muted-foreground">&mdash;</span>;
    const hasMissing = commandCenter.missingGear.some((m) => m.shiftId === shiftId);
    if (hasMissing) return <Badge variant="red">None</Badge>;
    if (cs.assignment.linkedBookingId) return <Badge variant="green">Linked</Badge>;
    return <Badge variant="orange">Unlinked</Badge>;
  }

  function DeleteCell({ shift, activeAssignment }: { shift: Shift; activeAssignment: Assignment | null }) {
    const hasAssignment = !!activeAssignment;
    return (
      <Popover
        open={deleteConfirmId === shift.id && hasAssignment}
        onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}
      >
        <PopoverTrigger asChild>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  if (hasAssignment) setDeleteConfirmId(shift.id);
                  else handleDeleteShift(shift.id, false);
                }}
                disabled={inlineActing !== null}
                className="text-muted-foreground/40 hover:text-destructive transition-colors disabled:pointer-events-none"
                aria-label="Remove shift"
              >
                <XIcon className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Remove shift</TooltipContent>
          </Tooltip>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-3" align="end">
          <p className="text-sm mb-3">This shift has an assigned worker. Remove it anyway?</p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={() => handleDeleteShift(shift.id, true)}>Remove</Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // ── Staff table (grouped by area) ──
  const staffTable = (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-28">Time</TableHead>
          <TableHead>Assigned</TableHead>
          <TableHead className="w-28">Status</TableHead>
          {commandCenter && <TableHead className="w-24">Gear</TableHead>}
          <TableHead className="w-6" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {AREAS.map((area) => {
          const shifts = shiftsByArea[area] ?? [];
          return [
            // Area sub-header
            <TableRow key={`header-${area}`} className="bg-muted/40 hover:bg-muted/40">
              <TableCell colSpan={commandCenter ? 4 : 3} className="py-1.5">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {AREA_LABELS[area] ?? area}
                </span>
              </TableCell>
              <TableCell className="py-1.5 text-right pr-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs text-muted-foreground" disabled={inlineActing !== null}>
                      <PlusIcon className="size-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-32">
                    <DropdownMenuItem onClick={() => handleAddShift(area, "ST")}>Student</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleAddShift(area, "FT")}>Full-time</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>,
            // Shift rows
            ...shifts.map((shift) => {
              const activeAssignment = shift.assignments.find(
                (a) => a.status === "DIRECT_ASSIGNED" || a.status === "APPROVED"
              ) ?? null;
              const pendingRequests = shift.assignments.filter((a) => a.status === "REQUESTED");
              return (
                <TableRow key={shift.id}>
                  <TableCell>
                    <span className="tabular-nums text-sm text-muted-foreground">
                      {formatTimeShort(shift.startsAt)}
                      {shift.workerType === "FT" && <Badge variant="gray" size="sm" className="ml-1.5">FT</Badge>}
                    </span>
                  </TableCell>
                  <TableCell>
                    <AssignCell shift={shift} activeAssignment={activeAssignment} />
                  </TableCell>
                  <TableCell>
                    <StatusCell shift={shift} activeAssignment={activeAssignment} pendingRequests={pendingRequests} />
                  </TableCell>
                  {commandCenter && (
                    <TableCell>
                      <GearCell shiftId={shift.id} hasAssignment={!!activeAssignment} />
                    </TableCell>
                  )}
                  <TableCell className="text-right pr-2">
                    <DeleteCell shift={shift} activeAssignment={activeAssignment} />
                  </TableCell>
                </TableRow>
              );
            }),
            // Empty area placeholder
            ...(shifts.length === 0 ? [
              <TableRow key={`empty-${area}`}>
                <TableCell colSpan={commandCenter ? 5 : 4} className="py-1.5 text-xs text-muted-foreground/50 italic pl-4">
                  No shifts
                </TableCell>
              </TableRow>
            ] : []),
          ];
        })}
      </TableBody>
    </Table>
  );

  // ── Student table (flat, read-only) ──
  const studentTable = (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Area</TableHead>
          <TableHead className="w-28">Time</TableHead>
          <TableHead>Assigned</TableHead>
          <TableHead className="w-28">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {shiftGroup.shifts.map((shift) => {
          const activeAssignment = shift.assignments.find(
            (a) => a.status === "DIRECT_ASSIGNED" || a.status === "APPROVED"
          ) ?? null;
          const pendingCount = shift.assignments.filter((a) => a.status === "REQUESTED").length;
          return (
            <TableRow key={shift.id}>
              <TableCell>
                <span className="flex items-center gap-1.5">
                  {AREA_LABELS[shift.area] ?? shift.area}
                  {shift.workerType === "FT" && <Badge variant="gray" size="sm">FT</Badge>}
                </span>
              </TableCell>
              <TableCell>
                <span className="tabular-nums text-muted-foreground text-sm">{formatTimeShort(shift.startsAt)}</span>
              </TableCell>
              <TableCell>
                {activeAssignment ? (
                  <span className="flex items-center gap-2">
                    <UserAvatar
                      name={activeAssignment.user.name}
                      avatarUrl={activeAssignment.user.avatarUrl}
                      size="sm"
                    />
                    {activeAssignment.user.name}
                  </span>
                ) : (
                  <span className="text-muted-foreground">&mdash;</span>
                )}
              </TableCell>
              <TableCell>
                {activeAssignment ? <Badge variant="green">Filled</Badge>
                  : pendingCount > 0 ? <Badge variant="orange">{pendingCount} req</Badge>
                  : <Badge variant="red">Open</Badge>}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );

  return (
    <Card className="mt-4">
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle>Crew</CardTitle>
          {coverage && (
            <Badge variant={coverageVariant} size="sm">
              {coverage.filled}/{coverage.total} filled
            </Badge>
          )}
        </div>
        {isStaffOrAdmin && (
          <Button variant="outline" size="sm" onClick={handleAutoFill} disabled={autoFilling || inlineActing !== null}>
            {autoFilling ? "Filling…" : "Auto-fill"}
          </Button>
        )}
      </CardHeader>

      <CardContent>
        {/* Gear summary badges (staff only) */}
        {commandCenter && isStaffOrAdmin && (
          commandCenter.gearSummary.byStatus.draft > 0 ||
          commandCenter.gearSummary.byStatus.reserved > 0 ||
          commandCenter.gearSummary.byStatus.checkedOut > 0 ||
          commandCenter.gearSummary.byStatus.completed > 0
        ) && (
          <div className="flex gap-2 flex-wrap mb-4">
            {commandCenter.gearSummary.byStatus.draft > 0 && <Badge variant="gray">{commandCenter.gearSummary.byStatus.draft} Draft</Badge>}
            {commandCenter.gearSummary.byStatus.reserved > 0 && <Badge variant="orange">{commandCenter.gearSummary.byStatus.reserved} Reserved</Badge>}
            {commandCenter.gearSummary.byStatus.checkedOut > 0 && <Badge variant="green">{commandCenter.gearSummary.byStatus.checkedOut} Checked out</Badge>}
            {commandCenter.gearSummary.byStatus.completed > 0 && <Badge variant="blue">{commandCenter.gearSummary.byStatus.completed} Returned</Badge>}
          </div>
        )}

        {isStaffOrAdmin ? staffTable : studentTable}

        {/* Missing gear actions (staff only) */}
        {commandCenter && commandCenter.missingGear.length > 0 && isStaffOrAdmin && (
          <div className="mt-4">
            <h3 className="text-sm mb-2">Missing Gear ({commandCenter.missingGear.length})</h3>
            <div className="flex flex-col gap-2">
              {commandCenter.missingGear.map((m) => (
                <div key={`${m.shiftId}-${m.userId}`} className="flex items-center justify-between px-3 py-2 bg-muted rounded-lg text-sm">
                  <div>
                    <strong>{m.userName}</strong>
                    <span className="text-muted-foreground ml-2">{AREA_LABELS[m.area] ?? m.area}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={acting !== null} onClick={() => onNudge(m.assignmentId, m.userName)}>
                      {acting === m.assignmentId ? "Sending..." : "Nudge"}
                    </Button>
                    <Button size="sm" asChild>
                      <Link href={`/checkouts?create=true&title=${titleParam}&startsAt=${dateParam}&endsAt=${endParam}${locationParam}${eventParam}&requesterUserId=${m.userId}`}>
                        Create checkout
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
