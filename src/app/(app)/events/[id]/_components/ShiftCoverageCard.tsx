"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { PlusIcon, XIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { formatTimeShort } from "@/lib/format";
import { handleAuthRedirect, parseErrorMessage } from "@/lib/errors";
import { UserAvatarPicker, type PickerUser } from "@/components/shift-detail/UserAvatarPicker";
import type { ShiftGroupSummary, CommandCenterData } from "../_utils";
import { AREA_LABELS } from "../_utils";

type ShiftCoverageCardProps = {
  shiftGroup: ShiftGroupSummary;
  commandCenter: CommandCenterData | null;
  currentUserRole: string;
  /** ID of the action currently in flight (nudge guard from parent) */
  acting: string | null;
  linkParams: {
    titleParam: string;
    dateParam: string;
    endParam: string;
    locationParam: string;
    eventParam: string;
  };
  onManageShifts: () => void;
  onNudge: (assignmentId: string, userName: string) => void;
  /** Called after any inline assignment or removal so parent can reload */
  onUpdated?: () => void;
};

export function ShiftCoverageCard({
  shiftGroup,
  commandCenter,
  currentUserRole,
  acting,
  linkParams,
  onManageShifts,
  onNudge,
  onUpdated,
}: ShiftCoverageCardProps) {
  const { titleParam, dateParam, endParam, locationParam, eventParam } = linkParams;
  const isStaffOrAdmin = currentUserRole === "STAFF" || currentUserRole === "ADMIN";

  // ── User picker state ──
  const [pickerShiftId, setPickerShiftId] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<PickerUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [inlineActing, setInlineActing] = useState<string | null>(null);
  const usersAbortRef = useRef<AbortController | null>(null);

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

  async function handleAssign(shiftId: string, userId: string) {
    setPickerShiftId(null);
    setInlineActing(shiftId);
    try {
      const res = await fetch("/api/shift-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shiftId, userId }),
      });
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        toast.success("Shift assigned");
        onUpdated?.();
      } else {
        const msg = await parseErrorMessage(res, "Assignment failed");
        toast.error(msg);
      }
    } catch {
      toast.error("Network error");
    }
    setInlineActing(null);
  }

  async function handleRemove(assignmentId: string) {
    setInlineActing(assignmentId);
    try {
      const res = await fetch(`/api/shift-assignments/${assignmentId}`, { method: "DELETE" });
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        toast.success("Assignment removed");
        onUpdated?.();
      } else {
        const msg = await parseErrorMessage(res, "Remove failed");
        toast.error(msg);
      }
    } catch {
      toast.error("Network error");
    }
    setInlineActing(null);
  }

  const coverage = shiftGroup.coverage;
  const coverageVariant = !coverage
    ? "gray"
    : coverage.percentage >= 100
    ? "green"
    : coverage.percentage > 0
    ? "orange"
    : "red";

  // ── Inline assign cell (staff only) ──
  function AssignCell({ shiftId, assignedName, assignmentId }: {
    shiftId: string;
    assignedName: string | null;
    assignmentId: string | null;
  }) {
    const isActing = inlineActing === shiftId || inlineActing === (assignmentId ?? "");

    if (assignedName && assignmentId) {
      return (
        <span className="flex items-center gap-2 group">
          <Avatar className="size-6">
            <AvatarFallback className="text-[10px] font-medium">
              {getInitials(assignedName)}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm">{assignedName}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => handleRemove(assignmentId)}
                disabled={isActing || acting !== null}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive ml-0.5"
                aria-label="Remove assignment"
              >
                <XIcon className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Remove assignment</TooltipContent>
          </Tooltip>
        </span>
      );
    }

    return (
      <Popover
        open={pickerShiftId === shiftId}
        onOpenChange={(open) => {
          if (open) { setPickerShiftId(shiftId); setUserSearch(""); loadUsers(); }
          else setPickerShiftId(null);
        }}
      >
        <PopoverTrigger asChild>
          <button
            className="group flex items-center gap-1.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors text-sm disabled:pointer-events-none"
            disabled={isActing || acting !== null}
          >
            {isActing ? (
              <span className="text-xs">Assigning…</span>
            ) : (
              <>
                <div className="size-6 shrink-0 rounded-full border-2 border-dashed border-muted-foreground/20 group-hover:border-primary/40 flex items-center justify-center transition-colors">
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
            onSelect={(userId) => handleAssign(shiftId, userId)}
            disabled={inlineActing !== null}
          />
        </PopoverContent>
      </Popover>
    );
  }

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
        <Button variant="outline" size="sm" onClick={onManageShifts}>
          Manage shifts
        </Button>
      </CardHeader>
      <CardContent>
        {/* Staff/admin: enhanced view with inline assignment + gear status */}
        {commandCenter && commandCenter.shifts.length > 0 && isStaffOrAdmin ? (
          <>
            {(commandCenter.gearSummary.byStatus.draft > 0 || commandCenter.gearSummary.byStatus.reserved > 0 || commandCenter.gearSummary.byStatus.checkedOut > 0 || commandCenter.gearSummary.byStatus.completed > 0) && (
              <div className="flex gap-2 flex-wrap mb-4">
                {commandCenter.gearSummary.byStatus.draft > 0 && <Badge variant="gray">{commandCenter.gearSummary.byStatus.draft} Draft</Badge>}
                {commandCenter.gearSummary.byStatus.reserved > 0 && <Badge variant="orange">{commandCenter.gearSummary.byStatus.reserved} Reserved</Badge>}
                {commandCenter.gearSummary.byStatus.checkedOut > 0 && <Badge variant="green">{commandCenter.gearSummary.byStatus.checkedOut} Checked out</Badge>}
                {commandCenter.gearSummary.byStatus.completed > 0 && <Badge variant="blue">{commandCenter.gearSummary.byStatus.completed} Returned</Badge>}
              </div>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Area</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Gear</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commandCenter.shifts.map((shift) => {
                  const hasMissingGear = shift.assignment && commandCenter.missingGear.some(
                    (m) => m.shiftId === shift.id
                  );
                  return (
                    <TableRow key={shift.id}>
                      <TableCell>
                        <span className="flex items-center gap-1.5">
                          {AREA_LABELS[shift.area] ?? shift.area}
                          {shift.workerType === "FT" && <Badge variant="gray" size="sm">FT</Badge>}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="tabular-nums text-muted-foreground text-sm">
                          {formatTimeShort(shift.startsAt)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <AssignCell
                          shiftId={shift.id}
                          assignedName={shift.assignment?.userName ?? null}
                          assignmentId={shift.assignment?.id ?? null}
                        />
                      </TableCell>
                      <TableCell>
                        {shift.assignment ? (
                          <Badge variant="green">Filled</Badge>
                        ) : shift.pendingRequests > 0 ? (
                          <Badge variant="orange">{shift.pendingRequests} req</Badge>
                        ) : (
                          <Badge variant="red">Open</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {!shift.assignment ? (
                          <span className="text-muted-foreground">&mdash;</span>
                        ) : hasMissingGear ? (
                          <Badge variant="red">None</Badge>
                        ) : shift.assignment.linkedBookingId ? (
                          <Badge variant="green">Linked</Badge>
                        ) : (
                          <Badge variant="orange">Unlinked</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {commandCenter.missingGear.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm mb-2">
                  Missing Gear ({commandCenter.missingGear.length})
                </h3>
                <div className="flex flex-col gap-2">
                  {commandCenter.missingGear.map((m) => (
                    <div
                      key={`${m.shiftId}-${m.userId}`}
                      className="flex items-center justify-between px-3 py-2 bg-muted rounded-lg text-sm"
                    >
                      <div>
                        <strong>{m.userName}</strong>
                        <span className="text-muted-foreground ml-2">
                          {AREA_LABELS[m.area] ?? m.area}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={acting !== null}
                          onClick={() => onNudge(m.assignmentId, m.userName)}
                        >
                          {acting === m.assignmentId ? "Sending..." : "Nudge"}
                        </Button>
                        <Button size="sm" asChild>
                          <Link
                            href={`/checkouts?create=true&title=${titleParam}&startsAt=${dateParam}&endsAt=${endParam}${locationParam}${eventParam}&requesterUserId=${m.userId}`}
                          >
                            Create checkout
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          /* Non-staff or no command center: basic shift table */
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Area</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shiftGroup.shifts.map((shift) => {
                const activeAssignment = shift.assignments.find(
                  (a) => a.status === "DIRECT_ASSIGNED" || a.status === "APPROVED"
                );
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
                      <span className="tabular-nums text-muted-foreground text-sm">
                        {formatTimeShort(shift.startsAt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {isStaffOrAdmin ? (
                        <AssignCell
                          shiftId={shift.id}
                          assignedName={activeAssignment?.user.name ?? null}
                          assignmentId={activeAssignment?.id ?? null}
                        />
                      ) : activeAssignment ? (
                        <span className="flex items-center gap-2">
                          <Avatar className="size-6">
                            <AvatarFallback className="text-[10px] font-medium">
                              {getInitials(activeAssignment.user.name)}
                            </AvatarFallback>
                          </Avatar>
                          {activeAssignment.user.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">&mdash;</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {activeAssignment ? (
                        <Badge variant="green">Filled</Badge>
                      ) : pendingCount > 0 ? (
                        <Badge variant="orange">{pendingCount} request{pendingCount > 1 ? "s" : ""}</Badge>
                      ) : (
                        <Badge variant="red">Open</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
