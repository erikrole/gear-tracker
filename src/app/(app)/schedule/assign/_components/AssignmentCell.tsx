"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { UserAvatarPicker } from "@/components/shift-detail/UserAvatarPicker";
import type { PickerUser } from "@/components/shift-detail/UserAvatarPicker";
import { handleAuthRedirect, parseErrorMessage } from "@/lib/errors";
import type { GridShift, GridAssignment } from "@/hooks/use-assignment-grid";

type Props = {
  shifts: GridShift[]; // all shifts for this event matching this area+workerType
  allUsers: PickerUser[];
  usersLoading: boolean;
  isStaff: boolean;
  onRefetch: () => void;
};

export function AssignmentCell({ shifts, allUsers, usersLoading, isStaff, onRefetch }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [acting, setActing] = useState(false);
  const [conflictMap, setConflictMap] = useState<Record<string, string>>({});
  const [conflictsLoading, setConflictsLoading] = useState(false);

  // All active assignments across all matching shifts
  const assignments: (GridAssignment & { shiftId: string })[] = shifts.flatMap((s) =>
    s.assignments.map((a) => ({ ...a, shiftId: s.id })),
  );

  // Find a shift with an open slot (no assignment yet)
  const openShift = shifts.find((s) => s.assignments.length === 0);

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
      // non-critical — picker still works without conflict data
    } finally {
      setConflictsLoading(false);
    }
  }, []);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen);
      if (isOpen && openShift) {
        fetchConflicts(openShift.id);
      } else if (!isOpen) {
        setSearch("");
        setConflictMap({});
      }
    },
    [openShift, fetchConflicts],
  );

  const handleAssign = useCallback(
    async (userId: string) => {
      if (!openShift || acting) return;
      setActing(true);
      try {
        const res = await fetch("/api/shift-assignments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shiftId: openShift.id, userId }),
        });
        if (handleAuthRedirect(res)) return;
        if (!res.ok) {
          const msg = await parseErrorMessage(res, "Failed to assign");
          toast.error(msg);
          return;
        }
        setOpen(false);
        onRefetch();
      } catch {
        toast.error("Network error — could not assign");
      } finally {
        setActing(false);
      }
    },
    [openShift, acting, onRefetch],
  );

  const handleRemove = useCallback(
    async (assignmentId: string) => {
      if (acting) return;
      setActing(true);
      try {
        const res = await fetch(`/api/shift-assignments/${assignmentId}`, { method: "DELETE" });
        if (handleAuthRedirect(res)) return;
        if (!res.ok) {
          const msg = await parseErrorMessage(res, "Failed to remove");
          toast.error(msg);
          return;
        }
        onRefetch();
      } catch {
        toast.error("Network error — could not remove");
      } finally {
        setActing(false);
      }
    },
    [acting, onRefetch],
  );

  if (shifts.length === 0) {
    return <td className="px-2 py-2 text-center text-muted-foreground/40 text-xs">—</td>;
  }

  return (
    <td className="px-2 py-1.5 align-middle border-l">
      <div className="flex flex-wrap items-center gap-1">
        {assignments.map((a) => (
          <button
            key={a.id}
            title={a.hasConflict ? `${a.user.name} — ${a.conflictNote ?? "schedule conflict"} — click to remove` : `${a.user.name} — click to remove`}
            disabled={!isStaff || acting}
            onClick={() => handleRemove(a.id)}
            className="group relative rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <UserAvatar
              name={a.user.name}
              avatarUrl={a.user.avatarUrl}
              size="default"
              className="ring-2 ring-background group-hover:ring-destructive/60 transition-all"
              fallbackClassName={
                a.hasConflict
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                  : undefined
              }
            />
            {a.hasConflict && (
              <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-yellow-400 border border-background" />
            )}
          </button>
        ))}

        {/* "+" button: staff only, when there's an open slot */}
        {isStaff && openShift && (
          <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="size-7 rounded-full text-muted-foreground hover:text-foreground"
                disabled={acting}
              >
                <span className="text-base leading-none">+</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="start">
              <p className="text-xs font-medium mb-2">Assign to shift</p>
              <UserAvatarPicker
                users={filteredUsers}
                loading={usersLoading}
                search={search}
                onSearchChange={setSearch}
                onSelect={handleAssign}
                disabled={acting}
                conflictMap={conflictMap}
                conflictsLoading={conflictsLoading}
              />
            </PopoverContent>
          </Popover>
        )}
      </div>
    </td>
  );
}
