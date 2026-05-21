"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UserAvatarPicker } from "@/components/shift-detail/UserAvatarPicker";
import type { PickerUser } from "@/components/shift-detail/UserAvatarPicker";
import { handleAuthRedirect, parseErrorMessage } from "@/lib/errors";
import type { GridShift, GridAssignment } from "@/hooks/use-assignment-grid";
import { cn } from "@/lib/utils";
import { PlusIcon, UserIcon, XIcon } from "lucide-react";
import { shiftWorkerLabel } from "@/lib/shift-display";

type Props = {
  shifts: GridShift[]; // all shifts for this event matching this area
  shiftGroupId: string | null;
  area: string;
  allUsers: PickerUser[];
  usersLoading: boolean;
  isStaff: boolean;
  onRefetch: () => void;
};

export function AssignmentCell({ shifts, shiftGroupId, area, allUsers, usersLoading, isStaff, onRefetch }: Props) {
  const [search, setSearch] = useState("");
  const [acting, setActing] = useState<string | null>(null);
  const actingRef = useRef(false);
  const [conflictMap, setConflictMap] = useState<Record<string, string>>({});
  const [conflictsLoading, setConflictsLoading] = useState(false);

  const filteredUsers = allUsers.filter((u) => {
    const q = search.toLowerCase();
    return u.name.toLowerCase().includes(q) || (u.primaryArea ?? "").toLowerCase().includes(q);
  });

  const fetchConflicts = useCallback(async (shiftId: string) => {
    setConflictsLoading(true);
    try {
      const res = await fetch(`/api/shifts/${shiftId}/conflicts`);
      if (res.ok) {
        const j = await res.json();
        setConflictMap(j.data ?? {});
      }
    } catch {
      // Non-critical: picker still works without conflict data.
    } finally {
      setConflictsLoading(false);
    }
  }, []);

  const handleAssign = useCallback(
    async (shiftId: string, userId: string) => {
      if (actingRef.current) return;
      actingRef.current = true;
      setActing(`assign-${shiftId}`);
      try {
        const res = await fetch("/api/shift-assignments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shiftId, userId }),
        });
        if (handleAuthRedirect(res)) return;
        if (!res.ok) {
          const msg = await parseErrorMessage(res, "Failed to assign");
          toast.error(msg);
          return;
        }
        onRefetch();
        toast.success("Assigned shift");
      } catch {
        toast.error("Network error - could not assign");
      } finally {
        actingRef.current = false;
        setActing(null);
      }
    },
    [onRefetch],
  );

  const handleRemove = useCallback(
    async (assignmentId: string) => {
      if (actingRef.current) return;
      actingRef.current = true;
      setActing(`remove-assignment-${assignmentId}`);
      try {
        const res = await fetch(`/api/shift-assignments/${assignmentId}`, { method: "DELETE" });
        if (handleAuthRedirect(res)) return;
        if (!res.ok) {
          const msg = await parseErrorMessage(res, "Failed to remove");
          toast.error(msg);
          return;
        }
        onRefetch();
        toast.success("Removed assignment");
      } catch {
        toast.error("Network error - could not remove");
      } finally {
        actingRef.current = false;
        setActing(null);
      }
    },
    [onRefetch],
  );

  const handleAddShift = useCallback(async (workerType: "FT" | "ST") => {
    if (!shiftGroupId || actingRef.current) return;
    actingRef.current = true;
    setActing(`add-${area}-${workerType}`);
    try {
      const res = await fetch(`/api/shift-groups/${shiftGroupId}/shifts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area, workerType }),
      });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) {
        const msg = await parseErrorMessage(res, "Failed to add slot");
        toast.error(msg);
        return;
      }
      onRefetch();
      toast.success(`Added ${shiftWorkerLabel(workerType)} slot`);
    } catch {
      toast.error("Network error - could not add slot");
    } finally {
      actingRef.current = false;
      setActing(null);
    }
  }, [area, onRefetch, shiftGroupId]);

  const handleDeleteShift = useCallback(async (shiftId: string) => {
    if (!shiftGroupId || actingRef.current) return;
    actingRef.current = true;
    setActing(`delete-${shiftId}`);
    try {
      const res = await fetch(`/api/shift-groups/${shiftGroupId}/shifts/${shiftId}`, { method: "DELETE" });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) {
        const msg = await parseErrorMessage(res, "Failed to remove slot");
        toast.error(msg);
        return;
      }
      onRefetch();
      toast.success("Removed slot");
    } catch {
      toast.error("Network error - could not remove slot");
    } finally {
      actingRef.current = false;
      setActing(null);
    }
  }, [onRefetch, shiftGroupId]);

  const canEditSlots = isStaff && Boolean(shiftGroupId);
  const assignedShifts = shifts
    .map((shift) => ({
      shift,
      assignment: shift.assignments[0] as (GridAssignment | undefined),
    }))
    .filter((entry): entry is { shift: GridShift; assignment: GridAssignment } => Boolean(entry.assignment));
  const openShifts = shifts.filter((shift) => shift.assignments.length === 0);
  const firstOpenShift = openShifts[0];
  const openCount = openShifts.length;
  const addSlotButton = canEditSlots ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 gap-1 px-2 text-xs text-muted-foreground/70 opacity-70 transition-[background-color,color,opacity,scale] hover:text-foreground hover:opacity-100 active:scale-[0.96] group-hover/cell:opacity-100 focus-visible:opacity-100"
          disabled={Boolean(acting)}
          aria-label={`Add ${area} staff or student slot`}
        >
          <PlusIcon className={cn("size-3.5", acting?.startsWith(`add-${area}-`) && "animate-pulse")} />
          Slot
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onClick={() => handleAddShift("FT")}>
          Add Staff slot
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleAddShift("ST")}>
          Add Student slot
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  return (
    <td className="group/cell border-l border-border/40 px-2 py-2 align-middle transition-colors hover:bg-muted/15">
      <div className="flex min-h-10 items-center justify-center gap-1.5">
        {shifts.length === 0 && (
          <div className="flex h-9 items-center justify-center text-xs text-muted-foreground/35">
            {addSlotButton ?? <span aria-hidden="true">—</span>}
            <span className="sr-only">No shift configured</span>
          </div>
        )}

        {assignedShifts.length > 0 && (
          <div className="flex items-center justify-center -space-x-2">
            {assignedShifts.map(({ shift, assignment }) => {
              const shiftActing = acting?.endsWith(shift.id) ?? false;
              return (
                <span
                  key={assignment.id}
                  className="group/avatar relative flex size-8 items-center justify-center rounded-full transition-[scale,z-index] hover:z-10 hover:scale-105 focus-within:z-10"
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex size-8 items-center justify-center rounded-full">
                        <UserAvatar
                          name={assignment.user.name}
                          avatarUrl={assignment.user.avatarUrl}
                          size="sm"
                          className="ring-2 ring-background transition-[box-shadow] group-hover/avatar:ring-destructive/60"
                          fallbackClassName={
                            assignment.hasConflict
                              ? "bg-[var(--orange-bg)] text-[var(--orange-text)]"
                              : undefined
                          }
                        />
                        {assignment.hasConflict && (
                          <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border border-background bg-[var(--orange)]" />
                        )}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <span className="font-medium">{assignment.user.name}</span>
                      {assignment.hasConflict && (
                        <span className="ml-1 text-muted-foreground">
                          {assignment.conflictNote ?? "Schedule conflict"}
                        </span>
                      )}
                    </TooltipContent>
                  </Tooltip>
                  {isStaff && (
                    <button
                      type="button"
                      disabled={Boolean(acting)}
                      onClick={() => handleRemove(assignment.id)}
                      aria-label={`Remove ${assignment.user.name} from shift`}
                      className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 shadow-sm transition-[opacity,scale] hover:scale-105 active:scale-[0.96] focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/avatar:opacity-100 group-focus-within/avatar:opacity-100 disabled:opacity-50"
                    >
                      <XIcon className={cn("size-3", shiftActing && "animate-pulse")} />
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        )}

        {firstOpenShift && (
          <div className="group/open flex items-center gap-0.5">
            <Popover
              onOpenChange={(isOpen) => {
                if (isOpen) void fetchConflicts(firstOpenShift.id);
                else {
                  setSearch("");
                  setConflictMap({});
                }
              }}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "inline-flex h-8 min-w-0 items-center gap-1.5 rounded-md bg-muted/25 px-2 text-left text-xs text-muted-foreground transition-[background-color,color,scale]",
                    "hover:bg-muted/45 hover:text-foreground active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
                  )}
                  disabled={!isStaff || Boolean(acting)}
                  aria-label={openCount > 1 ? `Assign one of ${openCount} open slots` : "Assign open slot"}
                  onClick={() => void fetchConflicts(firstOpenShift.id)}
                >
                  <UserIcon className={cn("size-3.5 opacity-70", acting?.endsWith(firstOpenShift.id) && "animate-pulse")} />
                  <span className="min-w-0 truncate font-medium">
                    {assignedShifts.length > 0 ? `${openCount} open` : `Assign ${shiftWorkerLabel(firstOpenShift.workerType)}`}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3" align="start">
                <p className="mb-2 text-xs font-medium">Assign to shift</p>
                <UserAvatarPicker
                  users={filteredUsers}
                  loading={usersLoading}
                  search={search}
                  onSearchChange={setSearch}
                  onSelect={(userId) => handleAssign(firstOpenShift.id, userId)}
                  disabled={Boolean(acting)}
                  conflictMap={conflictMap}
                  conflictsLoading={conflictsLoading}
                />
              </PopoverContent>
            </Popover>
            {isStaff && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="size-7 shrink-0 text-muted-foreground opacity-0 transition-[color,opacity,scale] hover:text-destructive active:scale-[0.96] group-hover/open:opacity-100 focus-visible:opacity-100"
                disabled={Boolean(acting)}
                aria-label={openCount > 1 ? "Remove one open slot" : "Remove open slot"}
                onClick={() => handleDeleteShift(firstOpenShift.id)}
              >
                <XIcon className={cn("size-3.5", acting?.endsWith(firstOpenShift.id) && "animate-pulse")} />
              </Button>
            )}
          </div>
        )}

        {shifts.length > 0 && addSlotButton}
      </div>
    </td>
  );
}
