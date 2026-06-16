"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangleIcon, PlusIcon, XIcon } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { handleAuthRedirect, isAbortError, parseErrorMessage, parseJsonSafely } from "@/lib/errors";
import { UserAvatarPicker, type PickerUser } from "@/components/shift-detail/UserAvatarPicker";
import { CallWindowEditor } from "@/components/shift-detail/CallWindowEditor";
import type { ShiftGroupSummary, CommandCenterData } from "../_utils";
import { AREA_LABELS } from "../_utils";
import { shiftWorkerLabel, shiftWorkerSlotLabel } from "@/lib/shift-display";
import { effectiveCallWindow } from "@/lib/shift-call-windows";

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
  const [actionError, setActionError] = useState("");
  const [createdShiftNotice, setCreatedShiftNotice] = useState("");
  const actionBusyRef = useRef(false);

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
        const json = await parseJsonSafely<{ data?: PickerUser[]; users?: PickerUser[] }>(res);
        const users = json?.data ?? json?.users;
        if (!users) {
          toast.error("User response was incomplete. Refresh and try again.");
          return;
        }
        setAllUsers(users.map((u) => ({
          id: u.id,
          name: u.name,
          role: u.role,
          primaryArea: u.primaryArea ?? null,
          avatarUrl: u.avatarUrl ?? null,
        })));
        setUsersLoaded(true);
      } else {
        toast.error(await parseErrorMessage(res, "Failed to load users"));
      }
    } catch (err) {
      if (isAbortError(err)) return;
      toast.error(err instanceof TypeError ? "You’re offline. Check your connection." : "Failed to load users");
    } finally {
      if (!ctrl.signal.aborted) setUsersLoading(false);
    }
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
      map[s.area]!.push(s);
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

  async function mutate(key: string, url: string, opts: RequestInit, successMsg: string, onSuccess?: () => void) {
    if (actionBusyRef.current) return;
    actionBusyRef.current = true;
    setInlineActing(key);
    setActionError("");
    setCreatedShiftNotice("");
    try {
      const res = await fetch(url, opts);
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        toast.success(successMsg);
        onSuccess?.();
        onUpdated?.();
      } else {
        const msg = await parseErrorMessage(res, "Action failed");
        setActionError(msg);
        toast.error(msg);
      }
    } catch {
      setActionError("Network error - check your connection");
      toast.error("You’re offline. Check your connection.");
    } finally {
      actionBusyRef.current = false;
      setInlineActing(null);
    }
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
    const label = shiftWorkerLabel(workerType);
    mutate(`add-${area}-${workerType}`, `/api/shift-groups/${groupId}/shifts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area, workerType }),
    }, `${AREA_LABELS[area] ?? area} ${label} shift added`, () => {
      setCreatedShiftNotice(`${AREA_LABELS[area] ?? area} ${label} shift added. Assign someone from the new open row, then link gear if needed.`);
    });
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
    if (actionBusyRef.current) return;
    actionBusyRef.current = true;
    setAutoFilling(true);
    try {
      const res = await fetch(`/api/shift-groups/${groupId}/auto-assign`, { method: "POST" });
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        const json = await parseJsonSafely<{ data?: { assigned?: number; conflicts?: number; skipped?: number } }>(res);
        if (!json?.data) {
          toast.error("Auto-fill completed, but the response was incomplete. Refresh and try again.");
          onUpdated?.();
          return;
        }
        const assigned = json.data.assigned ?? 0;
        const conflicts = json.data.conflicts ?? 0;
        if (assigned === 0) toast.info("No eligible workers found");
        else if (conflicts > 0) toast.warning(`${assigned} filled - ${conflicts} have conflicts`);
        else toast.success(`${assigned} shift${assigned !== 1 ? "s" : ""} auto-filled`);
        onUpdated?.();
      } else {
        const msg = await parseErrorMessage(res, "Auto-fill failed");
        toast.error(msg);
      }
    } catch (err) {
      toast.error(err instanceof TypeError ? "You’re offline. Check your connection." : "Auto-fill failed");
    } finally {
      actionBusyRef.current = false;
      setAutoFilling(false);
    }
  }

  // ── Sub-components ──

  function AssignCell({ shift, activeAssignment }: { shift: Shift; activeAssignment: Assignment | null }) {
    const isActing = inlineActing === shift.id || inlineActing === (activeAssignment?.id ?? "");

    if (activeAssignment) {
      return (
        <div className="group flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-2">
            <UserAvatar
              name={activeAssignment.user.name}
              avatarUrl={activeAssignment.user.avatarUrl}
              size="sm"
            />
            <span className="min-w-0 truncate text-sm">{activeAssignment.user.name}</span>
            {isStaffOrAdmin && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemove(activeAssignment.id)}
                    disabled={isActing || inlineActing !== null}
                    className="size-10 text-muted-foreground transition-[background-color,color,box-shadow] hover:text-destructive focus-visible:text-destructive sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                    aria-label="Remove assignment"
                  >
                    <XIcon className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Remove assignment</TooltipContent>
              </Tooltip>
            )}
          </span>
          {activeAssignment.hasConflict && (
            <Badge variant="orange" size="sm" className="w-fit gap-1">
              <AlertTriangleIcon className="size-3" />
              {activeAssignment.conflictNote ?? "Schedule conflict"}
            </Badge>
          )}
        </div>
      );
    }

    if (!isStaffOrAdmin) return <span className="text-muted-foreground">-</span>;

    return (
      <Popover
        open={pickerShiftId === shift.id}
        onOpenChange={(open) => {
          if (open) { setPickerShiftId(shift.id); setUserSearch(""); loadUsers(); }
          else setPickerShiftId(null);
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="group h-10 justify-start gap-1.5 px-1.5 text-muted-foreground/60 hover:text-muted-foreground"
            disabled={isActing || inlineActing !== null}
          >
            {isActing ? <span className="text-xs">Assigning...</span> : (
              <>
                <div className="size-6 rounded-full border-2 border-dashed border-muted-foreground/20 group-hover:border-primary/40 flex items-center justify-center transition-colors">
                  <PlusIcon className="size-3 text-muted-foreground/30 group-hover:text-primary/60 transition-colors" />
                </div>
                <span className="group-hover:text-muted-foreground/80">Assign</span>
              </>
            )}
          </Button>
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
              <Button type="button" variant="ghost" size="sm" className="h-10 px-1.5" aria-label={`${pendingRequests.length} pending shift request${pendingRequests.length === 1 ? "" : "s"}`}>
              <Badge variant="orange" className="cursor-pointer">
                {pendingRequests.length} req
              </Badge>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="start">
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Pending requests</p>
            <div className="flex flex-col gap-2">
              {pendingRequests.map((req) => (
                <div key={req.id} className="flex items-center justify-between gap-2">
                  <span className="text-sm truncate">{req.user.name}</span>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" className="h-10 px-2 text-xs" onClick={() => handleApprove(req.id)} disabled={inlineActing !== null}>
                      {inlineActing === req.id ? "..." : "Approve"}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-10 px-2 text-xs text-destructive" onClick={() => handleDecline(req.id)} disabled={inlineActing !== null}>
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
    if (!commandCenter || !hasAssignment) return <span className="text-muted-foreground">-</span>;
    const cs = gearMap.get(shiftId);
    if (!cs?.assignment) return <span className="text-muted-foreground">-</span>;
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
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (hasAssignment) setDeleteConfirmId(shift.id);
                  else handleDeleteShift(shift.id, false);
                }}
                disabled={inlineActing !== null}
                className="size-10 text-muted-foreground/50 hover:text-destructive focus-visible:text-destructive"
                aria-label="Remove shift"
              >
                <XIcon className="size-3.5" />
              </Button>
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
          <TableHead className="w-56">Call</TableHead>
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
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-10 text-muted-foreground"
                      disabled={inlineActing !== null}
                      aria-label={`Add ${AREA_LABELS[area] ?? area} staff or student slot`}
                    >
                      <PlusIcon className="size-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={() => handleAddShift(area, "FT")}>Add Staff slot</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleAddShift(area, "ST")}>Add Student slot</DropdownMenuItem>
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
                    <div className="flex flex-col items-start gap-1">
                      <div className="flex items-center gap-1.5">
                        <CallWindowEditor
                          target={{ type: "slot", id: shift.id }}
                          effectiveWindow={effectiveCallWindow(shift)}
                          overrideWindow={{ startsAt: shift.callStartsAt ?? null, endsAt: shift.callEndsAt ?? null }}
                          onSaved={onUpdated}
                          disabled={inlineActing !== null}
                          compact
                        />
                        <Badge variant="gray" size="sm">{shiftWorkerSlotLabel(shift.workerType)}</Badge>
                      </div>
                      {activeAssignment && (
                        <div className="flex flex-col items-start gap-1">
                          <CallWindowEditor
                            target={{ type: "assignment", id: activeAssignment.id }}
                            effectiveWindow={effectiveCallWindow(shift, activeAssignment)}
                            overrideWindow={{ startsAt: activeAssignment.callStartsAt ?? null, endsAt: activeAssignment.callEndsAt ?? null }}
                            onSaved={onUpdated}
                            disabled={inlineActing !== null}
                            compact
                          />
                          {activeAssignment.hasConflict && (
                            <Badge variant="orange" size="sm" className="max-w-56 gap-1">
                              <AlertTriangleIcon className="size-3 shrink-0" />
                              <span className="truncate">
                                {activeAssignment.conflictNote ?? "Schedule conflict"}
                              </span>
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
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
                <TableCell colSpan={commandCenter ? 5 : 4} className="py-0">
                  <EmptyState
                    inline
                    icon="users"
                    title={`No ${AREA_LABELS[area] ?? area} shifts`}
                    description="Add Staff and Student slots to match the crew minimum for this area."
                  />
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
          <TableHead className="w-36">Call</TableHead>
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
                  <Badge variant="gray" size="sm">{shiftWorkerSlotLabel(shift.workerType)}</Badge>
                </span>
              </TableCell>
              <TableCell>
                <CallWindowEditor
                  effectiveWindow={effectiveCallWindow(shift, activeAssignment)}
                  compact
                />
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
                  <span className="text-muted-foreground">-</span>
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
            {autoFilling ? "Filling..." : "Auto-fill"}
          </Button>
        )}
      </CardHeader>

      <CardContent>
        {(actionError || createdShiftNotice) && (
          <Alert variant={actionError ? "destructive" : "default"} className="mb-4">
            <AlertDescription>{actionError || createdShiftNotice}</AlertDescription>
          </Alert>
        )}

        {/* Gear summary badges (staff only) */}
        {commandCenter && isStaffOrAdmin && (
          commandCenter.gearSummary.byStatus.draft > 0 ||
          commandCenter.gearSummary.byStatus.reserved > 0 ||
          commandCenter.gearSummary.byStatus.pendingPickup > 0 ||
          commandCenter.gearSummary.byStatus.checkedOut > 0 ||
          commandCenter.gearSummary.byStatus.completed > 0
        ) && (
          <div className="flex gap-2 flex-wrap mb-4">
            {commandCenter.gearSummary.byStatus.draft > 0 && <Badge variant="gray">{commandCenter.gearSummary.byStatus.draft} Draft</Badge>}
            {commandCenter.gearSummary.byStatus.reserved > 0 && <Badge variant="purple">{commandCenter.gearSummary.byStatus.reserved} Reserved</Badge>}
            {commandCenter.gearSummary.byStatus.pendingPickup > 0 && <Badge variant="orange">{commandCenter.gearSummary.byStatus.pendingPickup} Awaiting pickup</Badge>}
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
                <div key={`${m.shiftId}-${m.userId}`} className="flex flex-col gap-2 rounded-lg bg-muted px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <strong>{m.userName}</strong>
                    <span className="text-muted-foreground ml-2">{AREA_LABELS[m.area] ?? m.area}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10"
                      disabled={acting !== null}
                      onClick={() => onNudge(m.assignmentId, m.userName)}
                    >
                      {acting === m.assignmentId ? "Sending..." : "Nudge"}
                    </Button>
                    <Button size="sm" className="h-10" asChild>
                      <Link href={`/reservations?create=true&title=${titleParam}&startsAt=${dateParam}&endsAt=${endParam}${locationParam}${eventParam}&requesterUserId=${m.userId}`}>
                        Reserve gear
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
