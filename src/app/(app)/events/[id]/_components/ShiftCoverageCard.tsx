"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangleIcon, Trash2Icon, XIcon } from "lucide-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { handleAuthRedirect, isAbortError, parseErrorMessage, parseJsonSafely } from "@/lib/errors";
import { UserAvatarPicker, type PickerUser } from "@/components/shift-detail/UserAvatarPicker";
import { CallWindowEditor } from "@/components/shift-detail/CallWindowEditor";
import type { ShiftGroupSummary, CommandCenterData } from "../_utils";
import { AREA_LABELS } from "../_utils";
import { shiftWorkerLabel, shiftWorkerLabelForProfile, shiftWorkerSlotLabel } from "@/lib/shift-display";
import { effectiveCallWindow, isInheritedFullDayCallWindow, type EffectiveCallWindow } from "@/lib/shift-call-windows";
import type { AutoFillPreviewResponse } from "@/lib/auto-fill-preview-types";
import { cn } from "@/lib/utils";
import {
  AddSlotMenu,
  AssignSlotButton,
  CREW_ROW_GROUP,
  CREW_ROW_REVEAL,
  CrewAreaHeading,
  CrewSlotStatus,
  CrewStateDot,
  CrewTypeLabel,
  areaLabel,
  crewSlotState,
  crewSlotStateLabel,
} from "@/components/shift-detail/crew-row";

const AREAS = ["VIDEO", "PHOTO", "GRAPHICS", "COMMS", "LIVE_PRODUCTION"] as const;

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
  const canEditPublishedSchedule = isStaffOrAdmin && !shiftGroup.hasWorkingCopy;

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
        setAllUsers(users);
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
    if (!canEditPublishedSchedule) {
      toast.error("Review or discard the private working schedule before changing live assignments.");
      return;
    }
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
    if (!canEditPublishedSchedule) {
      toast.error("Review or discard the private working schedule before running auto-fill.");
      return;
    }
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
    if (!canEditPublishedSchedule) {
      toast.error("Open Schedule to review and publish the private working copy.");
      return;
    }
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

  // ── Row renderers ──
  // Plain functions, not nested components: nested components get a fresh
  // identity on every render, which remounts every cell on each keystroke.

  function renderPerson(shift: Shift, activeAssignment: Assignment | null) {
    const isActing = inlineActing === shift.id || inlineActing === (activeAssignment?.id ?? "");

    if (activeAssignment) {
      return (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-2">
            <UserAvatar
              name={activeAssignment.user.name}
              avatarUrl={activeAssignment.user.avatarUrl}
              size="sm"
            />
            <span className="min-w-0 truncate text-sm">{activeAssignment.user.name}</span>
            {canEditPublishedSchedule && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleRemove(activeAssignment.id)}
                    disabled={isActing || inlineActing !== null}
                    className={cn(CREW_ROW_REVEAL, "text-muted-foreground hover:text-destructive focus-visible:text-destructive")}
                    aria-label={`Unassign ${activeAssignment.user.name}`}
                  >
                    <XIcon className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Unassign</TooltipContent>
              </Tooltip>
            )}
          </span>
          {activeAssignment.hasConflict && (
            <span className="flex items-center gap-1 pl-8 text-[11px] text-[var(--orange-text)]">
              <AlertTriangleIcon className="size-3 shrink-0" />
              <span className="truncate">{activeAssignment.conflictNote ?? "Schedule conflict"}</span>
            </span>
          )}
        </div>
      );
    }

    if (!canEditPublishedSchedule) return <span className="text-muted-foreground">-</span>;

    return (
      <Popover
        open={pickerShiftId === shift.id}
        onOpenChange={(open) => {
          if (open) { setPickerShiftId(shift.id); setUserSearch(""); loadUsers(); }
          else setPickerShiftId(null);
        }}
      >
        <PopoverTrigger asChild>
          <AssignSlotButton busy={isActing} disabled={isActing || inlineActing !== null} />
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

  function renderStatus(shift: Shift, activeAssignment: Assignment | null, pendingRequests: Assignment[]) {
    if (pendingRequests.length > 0 && canEditPublishedSchedule) {
      return (
        <Popover open={requestsShiftId === shift.id} onOpenChange={(open) => setRequestsShiftId(open ? shift.id : null)}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-ml-1.5 h-8 gap-2 px-1.5 font-normal text-muted-foreground hover:text-foreground"
              aria-label={`Review ${pendingRequests.length} pending shift request${pendingRequests.length === 1 ? "" : "s"}`}
            >
              <CrewStateDot state="requested" />
              {crewSlotStateLabel("requested", pendingRequests.length)}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3" align="start">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Pending requests</p>
            <div className="flex flex-col gap-2">
              {pendingRequests.map((req) => (
                <div key={req.id} className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm">{req.user.name}</span>
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" onClick={() => handleApprove(req.id)} disabled={inlineActing !== null}>
                      {inlineActing === req.id ? "..." : "Approve"}
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDecline(req.id)} disabled={inlineActing !== null}>
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

    return (
      <CrewSlotStatus
        state={crewSlotState(Boolean(activeAssignment), pendingRequests.length)}
        requestCount={pendingRequests.length}
      />
    );
  }

  function renderRowActions(shift: Shift, activeAssignment: Assignment | null) {
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
                size="icon-sm"
                onClick={() => {
                  if (hasAssignment) setDeleteConfirmId(shift.id);
                  else handleDeleteShift(shift.id, false);
                }}
                disabled={inlineActing !== null}
                className={cn(CREW_ROW_REVEAL, "text-muted-foreground hover:text-destructive focus-visible:text-destructive")}
                aria-label="Remove slot"
              >
                <Trash2Icon className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Remove slot</TooltipContent>
          </Tooltip>
        </PopoverTrigger>
        <PopoverContent className="w-60 p-3" align="end">
          <p className="mb-3 text-sm">This slot has an assigned worker. Remove it anyway?</p>
          <div className="flex justify-end gap-2">
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

  // Coalesce back-to-back identical changes (same label + actor + detail within
  // 5 min) so a save that fires "Republished schedule" twice reads as one row.
  const recentChanges = (() => {
    const raw = commandCenter?.recentChanges ?? [];
    const out: (typeof raw[number] & { repeatCount?: number })[] = [];
    for (const change of raw) {
      const last = out[out.length - 1];
      if (
        last &&
        last.label === change.label &&
        last.actorId === change.actorId &&
        last.detail === change.detail &&
        Math.abs(new Date(last.createdAt).getTime() - new Date(change.createdAt).getTime()) <= 5 * 60_000
      ) {
        last.repeatCount = (last.repeatCount ?? 1) + 1;
        continue;
      }
      out.push({ ...change });
    }
    return out;
  })();
  const reviewChangeCount = recentChanges.filter((change) => change.needsReview).length;

  // ── Crew table ──
  // One table for every role. Staff get the editing affordances (assign,
  // unassign, call time, add/remove slot); students get the same read of the
  // schedule plus their own acknowledge action.
  const crewTable = (
    <Table>
      <TableHeader>
        <TableRow striped={false}>
          <TableHead className="w-28">Call</TableHead>
          <TableHead className="w-24">Type</TableHead>
          <TableHead>Person</TableHead>
          <TableHead className="w-32">Status</TableHead>
          <TableHead className="w-32" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {AREAS.map((area) => {
          const shifts = shiftsByArea[area] ?? [];
          // Students have no way to add a slot, so an empty area is just noise.
          if (shifts.length === 0 && !isStaffOrAdmin) return [];
          const filledInArea = shifts.filter((s) =>
            s.assignments.some((a) => a.status === "DIRECT_ASSIGNED" || a.status === "APPROVED")
          ).length;
          return [
            // Area sub-header
            <TableRow key={`header-${area}`} striped={false} className="border-b-0 bg-transparent hover:bg-transparent">
              <TableCell colSpan={5} className="pt-5 pb-1.5">
                <CrewAreaHeading
                  area={area}
                  filled={filledInArea}
                  total={shifts.length}
                  action={canEditPublishedSchedule ? (
                    <AddSlotMenu
                      area={area}
                      disabled={inlineActing !== null}
                      onAdd={(workerType) => handleAddShift(area, workerType)}
                    />
                  ) : undefined}
                />
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
              // Only staff get an edit target; everyone reads the same time.
              const rowCallTarget = !canEditPublishedSchedule
                ? undefined
                : activeAssignment
                  ? { type: "assignment" as const, id: activeAssignment.id }
                  : { type: "slot" as const, id: shift.id };
              const rowCallOverride = activeAssignment
                ? { startsAt: activeAssignment.callStartsAt ?? null, endsAt: activeAssignment.callEndsAt ?? null }
                : { startsAt: shift.callStartsAt ?? null, endsAt: shift.callEndsAt ?? null };
              const rowClassLabel = activeAssignment
                ? shiftWorkerLabelForProfile(activeAssignment.user) ?? "Assigned"
                : shiftWorkerLabel(shift.workerType);
              const canAcknowledge = Boolean(
                currentUserId
                && activeAssignment
                && activeAssignment.user.id === currentUserId
                && publication?.publishedAt
                && (!activeAssignment.acknowledgedAt || activeAssignment.acknowledgedAt < publication.publishedAt),
              );
              return (
                <TableRow key={shift.id} striped={false} className={cn(CREW_ROW_GROUP, "border-border/40")}>
                  <TableCell className="py-2.5 text-muted-foreground">
                    {shouldShowCallWindow(rowCallWindow) ? (
                      <CallWindowEditor
                        target={rowCallTarget}
                        effectiveWindow={rowCallWindow}
                        overrideWindow={rowCallOverride}
                        onSaved={onUpdated}
                        disabled={inlineActing !== null}
                        compact
                        variant="bare"
                      />
                    ) : (
                      <span className="pl-0.5">-</span>
                    )}
                  </TableCell>
                  <TableCell className="py-2.5">
                    <CrewTypeLabel label={rowClassLabel} />
                  </TableCell>
                  <TableCell className="py-2.5">
                    {renderPerson(shift, activeAssignment)}
                  </TableCell>
                  <TableCell className="py-2.5">
                    {renderStatus(shift, activeAssignment, pendingRequests)}
                  </TableCell>
                  <TableCell className="py-2.5 pr-2 text-right">
                    {canEditPublishedSchedule
                      ? renderRowActions(shift, activeAssignment)
                      : canAcknowledge && activeAssignment ? (
                        <Button
                          size="sm"
                          onClick={() => handleAcknowledge(activeAssignment.id)}
                          disabled={acknowledgingId === activeAssignment.id}
                        >
                          {acknowledgingId === activeAssignment.id ? "Saving..." : "Acknowledge"}
                        </Button>
                      ) : null}
                  </TableCell>
                </TableRow>
              );
            }),
            // Empty area placeholder
            ...(shifts.length === 0 ? [
              <TableRow key={`empty-${area}`} striped={false} className="border-border/40">
                <TableCell colSpan={5} className="py-3 text-sm text-muted-foreground">
                  No {areaLabel(area).toLowerCase()} slots yet.
                </TableCell>
              </TableRow>
            ] : []),
          ];
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
            <Badge variant={coverageVariant} size="sm" className="tabular-nums">
              {coverage.filled}/{coverage.total} filled
            </Badge>
          )}
          <Badge variant={publicationBadge.variant} size="sm">
            {publicationBadge.label}
          </Badge>
        </div>
        {canEditPublishedSchedule && (
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
        {shiftGroup.hasWorkingCopy && isStaffOrAdmin && (
          <Alert className="mb-4">
            <AlertDescription>
              This event has unpublished Schedule changes. Review them in the <Link href="/schedule" className="font-medium underline">Schedule</Link> workstation before changing or publishing live assignments.
            </AlertDescription>
          </Alert>
        )}
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
          <div className="mb-4 flex flex-wrap gap-2">
            {commandCenter.gearSummary.byStatus.draft > 0 && <Badge variant="gray" size="sm">{commandCenter.gearSummary.byStatus.draft} draft</Badge>}
            {commandCenter.gearSummary.byStatus.reserved > 0 && <Badge variant="purple" size="sm">{commandCenter.gearSummary.byStatus.reserved} reserved</Badge>}
            {commandCenter.gearSummary.byStatus.pendingPickup > 0 && <Badge variant="orange" size="sm">{commandCenter.gearSummary.byStatus.pendingPickup} pending pickup</Badge>}
            {commandCenter.gearSummary.byStatus.checkedOut > 0 && <Badge variant="green" size="sm">{commandCenter.gearSummary.byStatus.checkedOut} checked out</Badge>}
            {commandCenter.gearSummary.byStatus.completed > 0 && <Badge variant="blue" size="sm">{commandCenter.gearSummary.byStatus.completed} returned</Badge>}
          </div>
        )}

        {crewTable}

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
                      {change.repeatCount && change.repeatCount > 1 && (
                        <Badge variant="gray" size="sm" className="tabular-nums">×{change.repeatCount}</Badge>
                      )}
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
          <div className="flex flex-col gap-4">
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
            <div className="max-h-80 flex flex-col gap-2 overflow-y-auto pr-1">
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
                  {slot.reasonDetails.length > 0 && (
                    <ul className="mt-1 list-disc flex flex-col gap-0.5 pl-4 text-xs text-muted-foreground">
                      {slot.reasonDetails.map((detail) => (
                        <li key={detail}>{detail}</li>
                      ))}
                    </ul>
                  )}
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
