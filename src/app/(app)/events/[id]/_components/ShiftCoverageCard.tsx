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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { effectiveCallWindow, isInheritedFullDayCallWindow, type EffectiveCallWindow } from "@/lib/shift-call-windows";
import type { AutoFillPreviewResponse } from "@/lib/auto-fill-preview-types";

const AREAS = ["VIDEO", "PHOTO", "GRAPHICS", "COMMS"] as const;

type Shift = ShiftGroupSummary["shifts"][number];
type Assignment = Shift["assignments"][number];

type Props = {
  shiftGroup: ShiftGroupSummary;
  commandCenter: CommandCenterData | null;
  currentUserId?: string;
  currentUserRole: string;
  acting: string | null;
  linkParams: {
    titleParam: string;
    dateParam: string;
    endParam: string;
    locationParam: string;
    eventParam: string;
  };
  eventAllDay?: boolean;
  onNudge: (assignmentId: string, userName: string) => void;
  onUpdated?: () => void;
};

export function ShiftCoverageCard({
  shiftGroup,
  commandCenter,
  currentUserId,
  currentUserRole,
  acting,
  linkParams,
  eventAllDay = false,
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
  const [autoFillApplying, setAutoFillApplying] = useState(false);
  const [autoFillPreview, setAutoFillPreview] = useState<AutoFillPreviewResponse | null>(null);
  const [autoFillPreviewOpen, setAutoFillPreviewOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);
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
  const publication = shiftGroup.publication;
  const publicationBadge = !publication?.publishedAt
    ? { label: "Draft", variant: "gray" as const }
    : publication.changedAfterPublish
      ? { label: "Changed", variant: "orange" as const }
      : publication.unacknowledgedCount > 0
        ? { label: `${publication.unacknowledgedCount} unacknowledged`, variant: "blue" as const }
        : { label: "Published", variant: "green" as const };

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
      const res = await fetch(`/api/shift-groups/${groupId}/auto-assign/preview`);
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        const json = await parseJsonSafely<{ data?: AutoFillPreviewResponse }>(res);
        if (!json?.data) {
          toast.error("Auto-fill preview could not be read. Refresh and try again.");
          return;
        }
        setAutoFillPreview(json.data);
        setAutoFillPreviewOpen(true);
      } else {
        const msg = await parseErrorMessage(res, "Auto-fill preview failed");
        toast.error(msg);
      }
    } catch (err) {
      toast.error(err instanceof TypeError ? "You’re offline. Check your connection." : "Auto-fill preview failed");
    } finally {
      actionBusyRef.current = false;
      setAutoFilling(false);
    }
  }

  async function handleApplyAutoFill() {
    if (actionBusyRef.current || !autoFillPreview) return;
    actionBusyRef.current = true;
    setAutoFillApplying(true);
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
        setAutoFillPreviewOpen(false);
        onUpdated?.();
      } else {
        const msg = await parseErrorMessage(res, "Auto-fill failed");
        toast.error(msg);
      }
    } catch (err) {
      toast.error(err instanceof TypeError ? "You’re offline. Check your connection." : "Auto-fill failed");
    } finally {
      actionBusyRef.current = false;
      setAutoFillApplying(false);
    }
  }

  async function handlePublish() {
    if (actionBusyRef.current) return;
    actionBusyRef.current = true;
    setPublishing(true);
    try {
      const res = await fetch(`/api/shift-groups/${groupId}/publish`, { method: "POST" });
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        toast.success(shiftGroup.publication?.publishedAt ? "Schedule republished" : "Schedule published");
        onUpdated?.();
      } else {
        toast.error(await parseErrorMessage(res, "Publish failed"));
      }
    } catch (err) {
      toast.error(err instanceof TypeError ? "You’re offline. Check your connection." : "Publish failed");
    } finally {
      actionBusyRef.current = false;
      setPublishing(false);
    }
  }

  async function handleAcknowledge(assignmentId: string) {
    if (actionBusyRef.current) return;
    actionBusyRef.current = true;
    setAcknowledgingId(assignmentId);
    try {
      const res = await fetch(`/api/shift-assignments/${assignmentId}/acknowledge`, { method: "POST" });
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        toast.success("Shift acknowledged");
        onUpdated?.();
      } else {
        toast.error(await parseErrorMessage(res, "Acknowledge failed"));
      }
    } catch (err) {
      toast.error(err instanceof TypeError ? "You’re offline. Check your connection." : "Acknowledge failed");
    } finally {
      actionBusyRef.current = false;
      setAcknowledgingId(null);
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

    if (activeAssignment) return <Badge variant="green" size="sm" className="h-6 px-2.5 text-[11px]">Filled</Badge>;
    if (pendingRequests.length > 0) return <Badge variant="orange" size="sm" className="h-6 px-2.5 text-[11px]">{pendingRequests.length} req</Badge>;
    return <Badge variant="red" size="sm" className="h-6 px-2.5 text-[11px]">Open</Badge>;
  }

  function GearCell({ shiftId, hasAssignment }: { shiftId: string; hasAssignment: boolean }) {
    if (!commandCenter || !hasAssignment) return <span className="text-muted-foreground">-</span>;
    const cs = gearMap.get(shiftId);
    if (!cs?.assignment) return <span className="text-muted-foreground">-</span>;
    const hasMissing = commandCenter.missingGear.some((m) => m.shiftId === shiftId);
    if (hasMissing) return <Badge variant="red" size="sm" className="h-6 px-2.5 text-[11px]">Missing gear</Badge>;
    if (cs.assignment.linkedBookingId) {
      if (cs.assignment.linkedBookingStatus === "PENDING_PICKUP") return <Badge variant="orange" size="sm" className="h-6 px-2.5 text-[11px]">Pickup ready</Badge>;
      if (cs.assignment.linkedBookingStatus === "OPEN") return <Badge variant="green" size="sm" className="h-6 px-2.5 text-[11px]">Checked out</Badge>;
      if (cs.assignment.linkedBookingStatus === "BOOKED") return <Badge variant="purple" size="sm" className="h-6 px-2.5 text-[11px]">Assignment gear</Badge>;
      return <Badge variant="green" size="sm" className="h-6 px-2.5 text-[11px]">Assignment gear</Badge>;
    }
    return <Badge variant="orange" size="sm" className="h-6 px-2.5 text-[11px]">Event reservation</Badge>;
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

function shouldShowCallWindow(window: EffectiveCallWindow): boolean {
    return !eventAllDay && !isInheritedFullDayCallWindow(window);
  }

  function changeTimeLabel(iso: string) {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  const recentChanges = commandCenter?.recentChanges ?? [];
  const reviewChangeCount = recentChanges.filter((change) => change.needsReview).length;

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
              const slotWindow = effectiveCallWindow(shift);
              const assignmentWindow = activeAssignment ? effectiveCallWindow(shift, activeAssignment) : null;
              const rowCallWindow = assignmentWindow ?? slotWindow;
              const rowCallTarget = activeAssignment
                ? { type: "assignment" as const, id: activeAssignment.id }
                : { type: "slot" as const, id: shift.id };
              const rowCallOverride = activeAssignment
                ? { startsAt: activeAssignment.callStartsAt ?? null, endsAt: activeAssignment.callEndsAt ?? null }
                : { startsAt: shift.callStartsAt ?? null, endsAt: shift.callEndsAt ?? null };
              return (
                <TableRow key={shift.id}>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <div className="flex items-center gap-1.5">
                        {shouldShowCallWindow(rowCallWindow) && (
                          <CallWindowEditor
                            target={rowCallTarget}
                            effectiveWindow={rowCallWindow}
                            overrideWindow={rowCallOverride}
                            onSaved={onUpdated}
                            disabled={inlineActing !== null}
                            compact
                            showSourceBadge={false}
                          />
                        )}
                        <Badge variant="gray" size="sm">{shiftWorkerSlotLabel(shift.workerType)}</Badge>
                      </div>
                      {activeAssignment?.hasConflict && (
                        <Badge variant="orange" size="sm" className="max-w-56 gap-1">
                          <AlertTriangleIcon className="size-3 shrink-0" />
                          <span className="truncate">
                            {activeAssignment.conflictNote ?? "Schedule conflict"}
                          </span>
                        </Badge>
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
          const callWindow = effectiveCallWindow(shift, activeAssignment);
          const canAcknowledge = Boolean(
            currentUserId
            && activeAssignment
            && activeAssignment.user.id === currentUserId
            && publication?.publishedAt
            && (!activeAssignment.acknowledgedAt || activeAssignment.acknowledgedAt < publication.publishedAt),
          );
          return (
            <TableRow key={shift.id}>
              <TableCell>
                <span className="flex items-center gap-1.5">
                  {AREA_LABELS[shift.area] ?? shift.area}
                  <Badge variant="gray" size="sm">{shiftWorkerSlotLabel(shift.workerType)}</Badge>
                </span>
              </TableCell>
              <TableCell>
                {shouldShowCallWindow(callWindow) ? (
                  <CallWindowEditor
                    effectiveWindow={callWindow}
                    compact
                    showSourceBadge={false}
                  />
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
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
                {canAcknowledge && activeAssignment ? (
                  <Button
                    size="sm"
                    className="h-9"
                    onClick={() => handleAcknowledge(activeAssignment.id)}
                    disabled={acknowledgingId === activeAssignment.id}
                  >
                    {acknowledgingId === activeAssignment.id ? "Saving..." : "Acknowledge"}
                  </Button>
                ) : activeAssignment ? <Badge variant="green">Filled</Badge>
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
    <>
    <Card className="mt-4">
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle>Crew</CardTitle>
          {coverage && (
            <Badge variant={coverageVariant} size="sm" className="h-6 px-2.5 text-[11px]">
              {coverage.filled}/{coverage.total} filled
            </Badge>
          )}
          <Badge variant={publicationBadge.variant} size="sm" className="h-6 px-2.5 text-[11px]">
            {publicationBadge.label}
          </Badge>
        </div>
        {isStaffOrAdmin && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleAutoFill} disabled={autoFilling || inlineActing !== null || publishing}>
              {autoFilling ? "Building preview..." : "Preview auto-fill"}
            </Button>
            <Button size="sm" onClick={handlePublish} disabled={publishing || inlineActing !== null}>
              {publishing ? "Publishing..." : shiftGroup.publication?.publishedAt ? "Republish" : "Publish"}
            </Button>
          </div>
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
            {commandCenter.gearSummary.byStatus.draft > 0 && <Badge variant="gray" size="sm" className="h-6 px-2.5 text-[11px]">{commandCenter.gearSummary.byStatus.draft} draft</Badge>}
            {commandCenter.gearSummary.byStatus.reserved > 0 && <Badge variant="purple" size="sm" className="h-6 px-2.5 text-[11px]">{commandCenter.gearSummary.byStatus.reserved} reserved</Badge>}
            {commandCenter.gearSummary.byStatus.pendingPickup > 0 && <Badge variant="orange" size="sm" className="h-6 px-2.5 text-[11px]">{commandCenter.gearSummary.byStatus.pendingPickup} awaiting pickup</Badge>}
            {commandCenter.gearSummary.byStatus.checkedOut > 0 && <Badge variant="green" size="sm" className="h-6 px-2.5 text-[11px]">{commandCenter.gearSummary.byStatus.checkedOut} checked out</Badge>}
            {commandCenter.gearSummary.byStatus.completed > 0 && <Badge variant="blue" size="sm" className="h-6 px-2.5 text-[11px]">{commandCenter.gearSummary.byStatus.completed} returned</Badge>}
          </div>
        )}

        {isStaffOrAdmin ? staffTable : studentTable}

        {isStaffOrAdmin && recentChanges.length > 0 && (
          <div className="mt-4 rounded-lg border border-border/60 bg-muted/20 px-3 py-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium">Recent schedule changes</h3>
              {reviewChangeCount > 0 ? (
                <Badge variant="orange">{reviewChangeCount} review</Badge>
              ) : (
                <Badge variant="gray">Audit trail</Badge>
              )}
            </div>
            <div className="divide-y divide-border/50">
              {recentChanges.slice(0, 5).map((change) => (
                <div key={change.id} className="grid gap-1 py-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-medium">{change.label}</span>
                      {change.needsReview && <Badge variant="orange" size="sm">Needs review</Badge>}
                    </div>
                    {change.detail && (
                      <p className="truncate text-xs text-muted-foreground">{change.detail}</p>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground sm:text-right">
                    {change.actorName} · {changeTimeLabel(change.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
    <Dialog open={autoFillPreviewOpen} onOpenChange={setAutoFillPreviewOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Auto-fill preview</DialogTitle>
          <DialogDescription>
            Review the proposed crew changes before applying them. Existing assignments stay unchanged until you apply.
          </DialogDescription>
        </DialogHeader>
        {autoFillPreview && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">Open slots</div>
                <div className="text-lg font-semibold tabular-nums">{autoFillPreview.summary.openSlots}</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">Proposed</div>
                <div className="text-lg font-semibold tabular-nums">{autoFillPreview.summary.proposed}</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">Warnings</div>
                <div className="text-lg font-semibold tabular-nums">{autoFillPreview.summary.warnings}</div>
              </div>
            </div>
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {autoFillPreview.proposals.map((proposal) => (
                <div key={proposal.shiftId} className="rounded-lg border border-border/60 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium">{proposal.userName}</div>
                      <div className="text-xs text-muted-foreground">
                        {AREA_LABELS[proposal.area] ?? proposal.area} · {shiftWorkerSlotLabel(proposal.workerType)}
                      </div>
                    </div>
                    <Badge variant={proposal.warnings.length > 0 ? "orange" : "green"} className="shrink-0 tabular-nums">
                      {proposal.score}
                    </Badge>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {[proposal.warnings[0]?.label, proposal.reasons[0]?.label].filter(Boolean).join(" · ")}
                  </div>
                </div>
              ))}
              {autoFillPreview.skipped.map((slot) => (
                <div key={slot.shiftId} className="rounded-lg border border-dashed border-border/70 p-3 text-sm">
                  <div className="font-medium">{AREA_LABELS[slot.area] ?? slot.area} · {shiftWorkerSlotLabel(slot.workerType)}</div>
                  <div className="text-xs text-muted-foreground">{slot.reason}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setAutoFillPreviewOpen(false)} disabled={autoFillApplying}>
            Cancel
          </Button>
          <Button onClick={handleApplyAutoFill} disabled={autoFillApplying || !autoFillPreview || autoFillPreview.proposals.length === 0}>
            {autoFillApplying ? "Applying..." : "Apply recommended assignments"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
