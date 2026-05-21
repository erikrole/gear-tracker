"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { AlertTriangleIcon, ArchiveIcon, ChevronDownIcon, ChevronRightIcon, EyeOffIcon, PlusIcon, UserIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { SkeletonTable } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import { formatDateShort, formatTimeShort } from "@/lib/format";
import { sportLabel } from "@/lib/sports";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UserAvatarGroup } from "@/components/UserAvatarGroup";
import { UserAvatarPicker, type PickerUser } from "@/components/shift-detail/UserAvatarPicker";
import { handleAuthRedirect, isAbortError, parseErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { VENUE_TONES, venueToneFromEvent } from "@/lib/venue-tone";
import { assignedRoleMismatchLabel, shiftWorkerLabel, shiftWorkerSlotLabel, type ShiftWorkerKind } from "@/lib/shift-display";
import type { CalendarEntry, Shift } from "./types";
import {
  ACTIVE_STATUSES,
  AREA_LABELS,
  coverageVariant,
  formatTime,
  scheduleEventTitleParts,
  userHasShift,
  userShiftStatus,
} from "./types";

type ListViewProps = {
  entries: CalendarEntry[];
  filteredEntries: CalendarEntry[];
  groupedEntries: [string, CalendarEntry[]][];
  loading: boolean;
  loadError: false | "network" | "server";
  loadData: () => void;
  myShiftsOnly: boolean;
  setMyShiftsOnly: (v: boolean) => void;
  clearFilters: () => void;
  includePast: boolean;
  hasFilters: boolean;
  currentUserId: string;
  isStaff: boolean;
  expandedRowId: string | null;
  setExpandedRowId: (id: string | null) => void;
  onSelectGroup: (groupId: string | null) => void;
  hidingEventIds?: Set<string>;
  onHideEvent?: (eventId: string) => void;
};

const AREA_BADGE_VARIANT: Record<string, "green" | "purple" | "orange" | "blue"> = {
  VIDEO: "green",
  PHOTO: "purple",
  COMMS: "orange",
  GRAPHICS: "blue",
};

function shiftAssignee(shift: Shift) {
  const active = shift.assignments.find((a) => ACTIVE_STATUSES.includes(a.status));
  return active?.user ?? null;
}

function activeShiftAssignment(shift: Shift) {
  return shift.assignments.find((a) => ACTIVE_STATUSES.includes(a.status)) ?? null;
}

function missingSlotCount(entry: CalendarEntry) {
  if (!entry.coverage) return 0;
  return Math.max(entry.coverage.total - entry.coverage.filled, 0);
}

function isShiftOpen(shift: Shift) {
  return !shift.assignments.some((a) => ACTIVE_STATUSES.includes(a.status));
}

function workerKindForShift(shift: Shift, _user: ReturnType<typeof shiftAssignee>): ShiftWorkerKind {
  return shift.workerType === "FT" ? "FT" : "ST";
}

function roleLabel(kind: ShiftWorkerKind) {
  return shiftWorkerLabel(kind);
}

function roleSlotLabel(kind: ShiftWorkerKind) {
  return shiftWorkerSlotLabel(kind);
}

function RoleNeedSummary({ entry, compact = false }: { entry: CalendarEntry; compact?: boolean }) {
  const openSlots = entry.shifts.filter(isShiftOpen);

  if (openSlots.length === 0) return null;

  const staff = openSlots.filter((shift) => workerKindForShift(shift, null) === "FT").length;
  const students = openSlots.length - staff;
  const parts = [
    staff > 0 ? `${staff} Staff` : null,
    students > 0 ? `${students} Student${students === 1 ? "" : "s"}` : null,
  ].filter(Boolean);

  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] leading-none", compact && "text-[10px]")}>
      <span className="font-semibold text-[var(--red-text)]">
        Needs
      </span>
      <span className="font-semibold text-muted-foreground">
        {parts.join(", ")}
      </span>
    </span>
  );
}

function eventStartLabel(entry: CalendarEntry) {
  return entry.allDay ? "All day" : formatTimeShort(entry.startsAt);
}

function callWindowLabel(startIso: string, endIso: string) {
  const start = formatTime(startIso);
  const end = formatTime(endIso);
  return start === end ? `Call ${start}` : `Call ${start} - ${end}`;
}

/* ── Coverage fraction badge ── */
function CoveragePill({ percentage, filled, total }: { percentage: number; filled: number; total: number }) {
  const variant = coverageVariant(percentage);
  return (
    <span className="flex items-center gap-1">
      <span
        className={cn(
          "inline-flex size-[7px] rounded-full flex-shrink-0",
          variant === "green" ? "bg-[var(--green)]" : variant === "orange" ? "bg-[var(--orange)]" : "bg-[var(--red)]",
        )}
      />
      <Badge variant={variant} size="sm">
        {filled}/{total}
      </Badge>
    </span>
  );
}

function formatShiftWindow(entry: CalendarEntry, shift: Shift) {
  if (entry.isHome !== true) return null;
  return `${formatTime(shift.startsAt)} - ${formatTime(shift.endsAt)}`;
}

function AssignmentAvatarGroup({
  entry,
  isExpanded,
}: {
  entry: CalendarEntry;
  isExpanded: boolean;
}) {
  const assignedUsers = entry.shifts
    .map(shiftAssignee)
    .filter((user): user is NonNullable<ReturnType<typeof shiftAssignee>> => Boolean(user));

  if (entry.shifts.length === 0) return null;

  return (
    <div
      className={cn(
        "ml-auto flex items-center gap-2 transition-[opacity,scale] duration-150",
        isExpanded ? "pointer-events-none opacity-0 scale-95" : "opacity-100 scale-100",
      )}
      aria-hidden={isExpanded}
    >
      <UserAvatarGroup users={assignedUsers} max={4} />
    </div>
  );
}

function ShiftRowList({
  entry,
  isStaff,
  pickerUsers,
  pickerLoading,
  pickerSearch,
  assigning,
  onOpenPicker,
  onClosePicker,
  onPickerSearchChange,
  onInlineAssign,
  currentUserId,
  postingTradeId,
  onPostTrade,
  addingShiftId,
  onAddShift,
  removingAssignmentId,
  onRemoveAssignment,
  onSelectGroup,
  compact = false,
}: {
  entry: CalendarEntry;
  isStaff: boolean;
  pickerUsers: PickerUser[];
  pickerLoading: boolean;
  pickerSearch: string;
  assigning: boolean;
  onOpenPicker: (shiftId: string) => void;
  onClosePicker: () => void;
  onPickerSearchChange: (value: string) => void;
  onInlineAssign: (shiftId: string, userId: string) => void;
  currentUserId: string;
  postingTradeId: string | null;
  onPostTrade?: (assignmentId: string) => void;
  addingShiftId: string | null;
  onAddShift?: (shift: Shift, workerType: ShiftWorkerKind) => void;
  removingAssignmentId: string | null;
  onRemoveAssignment?: (assignmentId: string) => void;
  onSelectGroup: () => void;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col", compact ? "gap-2" : "gap-1.5")}>
      {entry.shifts.map((shift) => {
        const activeAssignment = activeShiftAssignment(shift);
        const user = activeAssignment?.user ?? null;
        const myAssignment = shift.assignments.find(
          (a) => a.user.id === currentUserId && ACTIVE_STATUSES.includes(a.status),
        );
        const shiftTime = formatShiftWindow(entry, shift);
        const areaLabel = AREA_LABELS[shift.area] ?? shift.area;
        const assignedLabel = user ? user.name : "Unassigned";
        const workerType = workerKindForShift(shift, user);
        const slotLabel = roleSlotLabel(workerType);
        const emptyAssignLabel = `Assign ${roleLabel(workerType)}`;
        const mismatchLabel = activeAssignment
          ? assignedRoleMismatchLabel({ plannedWorkerType: workerType, assignedRole: activeAssignment.user.role })
          : null;
        const isAddingShift = addingShiftId === shift.id;
        const isRemovingAssignment = Boolean(activeAssignment && removingAssignmentId === activeAssignment.id);

        return (
          <div
            key={shift.id}
            className={cn(
              "min-h-12 rounded-md border border-border/40 bg-background/65 px-3 py-2 shadow-[0_1px_0_rgba(255,255,255,0.04)] transition-[background-color,border-color]",
              compact ? "flex flex-col gap-2" : "flex items-center gap-3",
            )}
          >
            <div className={cn("flex min-w-0 items-center gap-1.5", !compact && "w-32 shrink-0")}>
              <Badge
                variant={AREA_BADGE_VARIANT[shift.area] ?? "gray"}
                size="sm"
              >
                {areaLabel}
              </Badge>
              {isStaff && onAddShift && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="relative size-8 text-muted-foreground transition-[background-color,color,scale] before:absolute before:-inset-1 before:content-[''] hover:text-foreground active:scale-[0.96]"
                      disabled={Boolean(addingShiftId)}
                      aria-label={`Add another ${areaLabel} ${slotLabel.toLowerCase()}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddShift(shift, workerType);
                      }}
                    >
                      <PlusIcon className={cn("size-3.5", isAddingShift && "animate-pulse")} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Add another {slotLabel.toLowerCase()}</TooltipContent>
                </Tooltip>
              )}
            </div>

            <div className="min-w-0 flex-1">
              {user ? (
                <div className="group/assignment flex min-h-10 w-full items-center rounded-md px-2 transition-[background-color] hover:bg-muted/45 focus-within:bg-muted/45">
                  <button
                    type="button"
                    className="inline-grid min-w-0 max-w-[70%] grid-cols-[24px_minmax(0,1fr)] items-center gap-2 rounded-md text-left transition-[scale] active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
                    aria-label={`Open ${areaLabel} shift assigned to ${user.name}`}
                    onClick={onSelectGroup}
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center">
                      <UserAvatar
                        name={user.name}
                        avatarUrl={user.avatarUrl}
                        size="sm"
                      />
                    </span>
                    <span className="min-w-0 truncate text-sm font-medium">
                      {user.name}
                    </span>
                  </button>
                  {isStaff && activeAssignment && onRemoveAssignment && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="ml-1 size-8 text-muted-foreground opacity-0 transition-[background-color,color,opacity,scale] hover:text-destructive active:scale-[0.96] focus-visible:opacity-100 group-hover/assignment:opacity-100 group-focus-within/assignment:opacity-100"
                          disabled={Boolean(removingAssignmentId)}
                          aria-label={`Remove ${user.name} from ${areaLabel} shift`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveAssignment(activeAssignment.id);
                          }}
                        >
                          <XIcon className={cn("size-3.5", isRemovingAssignment && "animate-pulse")} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Remove assignment</TooltipContent>
                    </Tooltip>
                  )}
                  <span className="ml-auto shrink-0 text-xs font-medium text-muted-foreground">
                    {mismatchLabel ?? roleLabel(workerType)}
                  </span>
                </div>
              ) : isStaff ? (
                <Popover
                  onOpenChange={(open) => {
                    if (open) onOpenPicker(shift.id);
                    else onClosePicker();
                  }}
                >
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="group grid min-h-10 w-full grid-cols-[24px_minmax(0,1fr)] items-center gap-2 rounded-md bg-muted/25 px-2 text-left transition-[background-color,scale] hover:bg-muted/45 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
                      disabled={assigning}
                      aria-label={`${emptyAssignLabel} to ${areaLabel}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-background/70 text-muted-foreground shadow-[inset_0_0_0_1px_hsl(var(--border)/0.55)]">
                        <UserIcon className="size-3 opacity-70" />
                      </div>
                      <span className="min-w-0 truncate text-sm font-medium text-muted-foreground group-hover:text-foreground">
                        {emptyAssignLabel}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-64 p-2"
                    align="start"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <UserAvatarPicker
                      users={pickerUsers}
                      loading={pickerLoading}
                      search={pickerSearch}
                      onSearchChange={onPickerSearchChange}
                      onSelect={(userId) => onInlineAssign(shift.id, userId)}
                      disabled={assigning}
                    />
                  </PopoverContent>
                </Popover>
              ) : (
                <button
                  type="button"
                  className="flex min-h-10 w-full items-center gap-2 rounded-md px-1 text-left transition-[background-color,scale] hover:bg-muted/45 active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
                  aria-label={`Open unassigned ${areaLabel} shift`}
                  onClick={onSelectGroup}
                >
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-muted-foreground/30 text-muted-foreground">
                    <UserIcon className="size-3 opacity-65" />
                  </div>
                  <span className="min-w-0 truncate text-sm font-medium text-muted-foreground">
                    {slotLabel}
                  </span>
                </button>
              )}
            </div>

            {shiftTime && (
              <div className={cn("min-w-0", !compact && "w-36 shrink-0")}>
                <span
                  className="truncate text-[11px] text-muted-foreground tabular-nums"
                  style={{ fontFamily: "var(--font-mono)" }}
                  title={`${assignedLabel} · ${shiftTime}`}
                >
                  {shiftTime}
                </span>
              </div>
            )}

            <div className={cn("flex min-h-9", compact ? "justify-start" : "w-24 shrink-0 justify-end")}>
              {onPostTrade && myAssignment && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 shrink-0 px-2 text-xs text-muted-foreground transition-[background-color,color,scale] hover:text-foreground active:scale-[0.96]"
                  disabled={postingTradeId === myAssignment.id}
                  onClick={async (e) => {
                    e.stopPropagation();
                    onPostTrade(myAssignment.id);
                  }}
                >
                  {postingTradeId === myAssignment.id ? "Posting..." : "Trade"}
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ListView({
  entries,
  filteredEntries,
  groupedEntries,
  loading,
  loadError,
  loadData,
  myShiftsOnly,
  setMyShiftsOnly,
  clearFilters,
  includePast,
  hasFilters,
  currentUserId,
  isStaff,
  expandedRowId,
  setExpandedRowId,
  onSelectGroup,
  hidingEventIds,
  onHideEvent,
}: ListViewProps) {

  // Scroll to today when includePast is toggled on and data has loaded
  const todayGroupRef = useRef<HTMLDivElement>(null);
  const didScrollRef = useRef(false);
  useEffect(() => {
    if (!includePast) { didScrollRef.current = false; return; }
    if (didScrollRef.current || !todayGroupRef.current) return;
    didScrollRef.current = true;
    todayGroupRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [includePast, groupedEntries]);

  // Inline assignment state
  const [allUsers, setAllUsers] = useState<PickerUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const usersLoadedRef = useRef(false);
  const [userSearch, setUserSearch] = useState("");
  const [assigning, setAssigning] = useState(false);
  const assigningRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const loadUsers = useCallback(async () => {
    if (usersLoadedRef.current) return;
    usersLoadedRef.current = true;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setUsersLoading(true);
    try {
      const res = await fetch("/api/users?limit=200&active=true", { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        const json = await res.json();
        setAllUsers((json.data ?? []).map((u: { id: string; name: string; role: string; primaryArea: string | null; avatarUrl?: string | null }) => ({
          id: u.id, name: u.name, role: u.role, primaryArea: u.primaryArea, avatarUrl: u.avatarUrl,
        })));
      } else {
        usersLoadedRef.current = false;
        const msg = await parseErrorMessage(res, "Failed to load users");
        toast.error(msg);
      }
    } catch (err) {
      if (isAbortError(err)) return;
      toast.error("Failed to load users");
      usersLoadedRef.current = false;
    }
    finally { setUsersLoading(false); }
  }, []);

  const filteredUsers = useMemo(() => {
    let users = allUsers;
    if (userSearch) {
      const q = userSearch.toLowerCase();
      users = users.filter((u) => u.name.toLowerCase().includes(q));
    }
    return users;
  }, [allUsers, userSearch]);

  const [postingTradeId, setPostingTradeId] = useState<string | null>(null);
  const postingTradeRef = useRef<string | null>(null);
  const [tradeDialogAssignmentId, setTradeDialogAssignmentId] = useState<string | null>(null);
  const [tradeNotes, setTradeNotes] = useState("");
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [addingShiftId, setAddingShiftId] = useState<string | null>(null);
  const addingShiftRef = useRef(false);
  const [removingAssignmentId, setRemovingAssignmentId] = useState<string | null>(null);
  const removingAssignmentRef = useRef(false);

  const openTradeDialog = useCallback((assignmentId: string) => {
    if (postingTradeRef.current) return;
    setTradeDialogAssignmentId(assignmentId);
    setTradeNotes("");
    setTradeError(null);
  }, []);

  const closeTradeDialog = useCallback(() => {
    if (postingTradeRef.current) return;
    setTradeDialogAssignmentId(null);
    setTradeNotes("");
    setTradeError(null);
  }, []);

  const handlePostTrade = useCallback(async (assignmentId: string, notes: string) => {
    if (postingTradeRef.current) return;
    postingTradeRef.current = assignmentId;
    setPostingTradeId(assignmentId);
    setTradeError(null);
    try {
      const trimmedNotes = notes.trim();
      const res = await fetch("/api/shift-trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftAssignmentId: assignmentId,
          ...(trimmedNotes ? { notes: trimmedNotes } : {}),
        }),
      });
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        toast.success("Shift posted to trade board");
        setTradeDialogAssignmentId(null);
        setTradeNotes("");
        loadData();
      } else {
        const msg = await parseErrorMessage(res, "Failed to post trade");
        setTradeError(msg);
        toast.error(msg);
      }
    } catch {
      const msg = "Network error - could not post trade";
      setTradeError(msg);
      toast.error(msg);
    } finally {
      postingTradeRef.current = null;
      setPostingTradeId(null);
    }
  }, [loadData]);

  const handleInlineAssign = useCallback(async (shiftId: string, userId: string) => {
    if (assigningRef.current) return;
    assigningRef.current = true;
    setAssigning(true);
    try {
      const res = await fetch("/api/shift-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shiftId, userId }),
      });
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        setUserSearch("");
        loadData();
        toast.success("Assigned shift");
      } else {
        const msg = await parseErrorMessage(res, "Failed to assign shift");
        toast.error(msg);
      }
    } catch {
      toast.error("Network error - could not assign shift");
    }
    finally {
      assigningRef.current = false;
      setAssigning(false);
    }
  }, [loadData]);

  const handleRemoveAssignment = useCallback(async (assignmentId: string) => {
    if (removingAssignmentRef.current) return;
    removingAssignmentRef.current = true;
    setRemovingAssignmentId(assignmentId);
    try {
      const res = await fetch(`/api/shift-assignments/${assignmentId}`, { method: "DELETE" });
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        toast.success("Assignment removed");
        loadData();
      } else {
        const msg = await parseErrorMessage(res, "Failed to remove assignment");
        toast.error(msg);
      }
    } catch {
      toast.error("Network error - could not remove assignment");
    } finally {
      removingAssignmentRef.current = false;
      setRemovingAssignmentId(null);
    }
  }, [loadData]);

  const handleAddMatchingShift = useCallback(async (entry: CalendarEntry, shift: Shift, workerType: ShiftWorkerKind) => {
    if (!entry.shiftGroupId || addingShiftRef.current) return;
    addingShiftRef.current = true;
    setAddingShiftId(shift.id);
    const areaLabel = AREA_LABELS[shift.area] ?? shift.area;
    const slotLabel = roleLabel(workerType).toLowerCase();
    try {
      const res = await fetch(`/api/shift-groups/${entry.shiftGroupId}/shifts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          area: shift.area,
          workerType,
          startsAt: shift.startsAt,
          endsAt: shift.endsAt,
        }),
      });
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        toast.success(`Added ${areaLabel} ${slotLabel} shift`);
        loadData();
      } else {
        const msg = await parseErrorMessage(res, "Failed to add shift");
        toast.error(msg);
      }
    } catch {
      toast.error("Network error - could not add shift");
    } finally {
      addingShiftRef.current = false;
      setAddingShiftId(null);
    }
  }, [loadData]);

  return (
    <>
      <div className="border border-border/60 rounded-lg overflow-hidden bg-card">
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/20">
          <div className="flex items-center gap-2">
            <h3
              className="text-sm font-bold uppercase tracking-wider text-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {myShiftsOnly ? "My Shifts" : includePast ? "All Events" : "Upcoming Events"}
            </h3>
            <span className="text-xs text-muted-foreground font-medium">
              {filteredEntries.length !== entries.length
                ? `${filteredEntries.length} of ${entries.length}`
                : filteredEntries.length}
            </span>
          </div>
        </div>

        {loading ? (
          <SkeletonTable rows={6} cols={3} />
        ) : loadError ? (
          <div className="p-8 text-center">
            <p className="text-sm text-muted-foreground mb-3">
              {loadError === "network"
                ? "You appear to be offline. Check your connection and try again."
                : "Something went wrong loading schedule data."}
            </p>
            <Button variant="outline" size="sm" onClick={loadData}>
              Retry
            </Button>
          </div>
        ) : filteredEntries.length === 0 ? (
          <EmptyState
            icon="calendar"
            title={myShiftsOnly ? "No shifts assigned" : "No events found"}
            description={
              myShiftsOnly
                ? "You don't have any upcoming shift assignments."
                : hasFilters
                  ? "Try adjusting your filters."
                  : "No upcoming events. Check Settings > Calendar Sources to add an ICS feed."
            }
            actionLabel={
              myShiftsOnly
                ? "Show all events"
                : hasFilters
                  ? "Clear filters"
                  : "Calendar Sources"
            }
            actionHref={
              myShiftsOnly
                ? undefined
                : hasFilters
                  ? undefined
                  : "/settings/calendar-sources"
            }
            onAction={
              myShiftsOnly ? () => setMyShiftsOnly(false) : hasFilters ? clearFilters : undefined
            }
          />
        ) : (
          <>
            {/* ── Desktop: timeline table ── */}
            <div className="max-md:hidden">
              {groupedEntries.map(([dateKey, groupEntries], groupIdx) => {
                const groupDate = new Date(dateKey);
                const isGroupToday =
                  groupDate.toDateString() === new Date().toDateString();

              return (
                <div key={dateKey} ref={isGroupToday ? todayGroupRef : undefined}>
                  {/* Date group header - timeline style */}
                  <div
                    className={cn(
                      "sticky top-0 z-10 flex items-stretch border-b border-border/50",
                      isGroupToday ? "bg-[#A00000]/[0.04]" : "bg-card",
                    )}
                  >
                    {/* Date marker */}
                    <div
                      className={cn(
                        "flex flex-col items-center justify-center px-4 py-2 border-r border-border/40 w-[56px] flex-shrink-0",
                        isGroupToday ? "text-[#A00000]" : "text-muted-foreground",
                      )}
                    >
                      <span
                        className="text-[9px] font-bold uppercase tracking-widest leading-none"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        {groupDate.toLocaleDateString("en-US", { weekday: "short" })}
                      </span>
                      <span
                        className={cn(
                          "text-[22px] font-black leading-tight tabular-nums",
                          isGroupToday ? "text-[#A00000]" : "text-foreground",
                        )}
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        {groupDate.getDate()}
                      </span>
                      <span
                        className="text-[9px] leading-none text-muted-foreground"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        {groupDate.toLocaleDateString("en-US", { month: "short" })}
                      </span>
                    </div>

                    {/* Event count + today label */}
                    <div className="flex items-center gap-2 px-3">
                      <span className="text-xs font-medium text-muted-foreground">
                        {groupEntries.length} event{groupEntries.length !== 1 ? "s" : ""}
                      </span>
                      {isGroupToday && (
                        <span
                          className="text-[10px] font-black text-[#A00000] uppercase tracking-widest"
                          style={{ fontFamily: "var(--font-heading)" }}
                        >
                          Today
                        </span>
                      )}
                    </div>
                  </div>

                  <table className="w-full border-collapse">
                    <colgroup>
                      <col style={{ width: "48px" }} />
                      <col />
                      <col style={{ width: "180px" }} />
                    </colgroup>
                    <thead className={groupIdx === 0 ? "" : "hidden"}>
                      <tr>
                        <th className="w-12"></th>
                        <th className="text-left px-4 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border/40">
                          Event
                        </th>
                        <th className="text-left px-4 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border/40">
                          Call
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupEntries.map((entry) => {
                        const isExpanded = expandedRowId === entry.id;
                        const hasShifts = entry.shifts.length > 0;
                        const isAssignedToMe = currentUserId ? userHasShift(entry, currentUserId) : false;
                        const shiftStatus = currentUserId
                          ? userShiftStatus(entry, currentUserId)
                          : null;

                        return (
                          <EventRows
                            key={entry.id}
                            entry={entry}
                            isExpanded={isExpanded}
                            hasShifts={hasShifts}
                            isAssignedToMe={isAssignedToMe}
                            shiftStatus={shiftStatus}
                            isStaff={isStaff}
                            onToggle={() =>
                              setExpandedRowId(isExpanded ? null : entry.id)
                            }
                            onSelectGroup={() =>
                              onSelectGroup(entry.shiftGroupId)
                            }
                            isHiding={hidingEventIds?.has(entry.id) ?? false}
                            onHide={
                              onHideEvent ? () => onHideEvent(entry.id) : undefined
                            }
                            pickerUsers={filteredUsers}
                            pickerLoading={usersLoading}
                            pickerSearch={userSearch}
                            assigning={assigning}
                            onOpenPicker={(shiftId) => {
                              setUserSearch("");
                              loadUsers();
                            }}
                            onClosePicker={() => {
                              setUserSearch("");
                            }}
                            onPickerSearchChange={setUserSearch}
                            onInlineAssign={handleInlineAssign}
                            currentUserId={currentUserId}
                            showShiftStatus={myShiftsOnly}
                            postingTradeId={postingTradeId}
                            addingShiftId={addingShiftId}
                            onAddShift={(shift, workerType) => handleAddMatchingShift(entry, shift, workerType)}
                            removingAssignmentId={removingAssignmentId}
                            onRemoveAssignment={handleRemoveAssignment}
                            onPostTrade={isStaff ? undefined : openTradeDialog}
                          />
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>

          {/* ── Mobile: card list ── */}
          <div className="hidden max-md:flex flex-col">
            {filteredEntries.map((entry) => {
              const isExpanded = expandedRowId === entry.id;
              const isAssignedToMe = currentUserId ? userHasShift(entry, currentUserId) : false;
              const shiftStatus = currentUserId
                ? userShiftStatus(entry, currentUserId)
                : null;
              const titleParts = scheduleEventTitleParts(entry);

              const venueTone = VENUE_TONES[venueToneFromEvent(entry)];
              const missingSlots = missingSlotCount(entry);

              return (
                <div
                  key={entry.id}
                  className={cn(
                    "border-b border-border/50 last:border-b-0 border-l-[3px]",
                    venueTone.railClass,
                    missingSlots > 0
                      ? "bg-[var(--red-bg)]/15"
                      : isAssignedToMe && "bg-primary/5",
                  )}
                >
                  <button
                    className="w-full text-left px-4 py-3"
                    onClick={() =>
                      entry.shifts.length > 0
                        ? setExpandedRowId(isExpanded ? null : entry.id)
                        : undefined
                    }
                    aria-expanded={entry.shifts.length > 0 ? isExpanded : undefined}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="font-semibold text-sm flex items-center gap-1.5 leading-tight">
                        {entry.shifts.length > 0 && (
                          isExpanded ? (
                            <ChevronDownIcon className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
                          ) : (
                            <ChevronRightIcon className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
                          )
                        )}
                        <span
                          className="text-[10px] text-muted-foreground/60 tabular-nums font-normal shrink-0"
                          style={{ fontFamily: entry.allDay ? "var(--font-heading)" : "var(--font-mono)" }}
                        >
                          {eventStartLabel(entry)}
                        </span>
                        {titleParts.title}
                      </span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {(() => {
                          const mobileCallTime = entry.isHome === true && entry.shifts.length > 0
                            ? formatTime(entry.shifts.reduce((min, s) => s.startsAt < min ? s.startsAt : min, entry.shifts[0]!.startsAt))
                            : null;
                          return mobileCallTime ? (
                            <span
                              className="text-[10px] text-muted-foreground/50 tabular-nums"
                              style={{ fontFamily: "var(--font-mono)" }}
                            >
                              Call {mobileCallTime}
                            </span>
                          ) : null;
                        })()}
                        {myShiftsOnly && shiftStatus === "Pending" && (
                          <Badge
                            variant="orange"
                            size="sm"
                          >
                            {shiftStatus}
                          </Badge>
                        )}
                        {entry.coverage && (
                          <Badge
                            variant={coverageVariant(entry.coverage.percentage)}
                            size="sm"
                          >
                            {entry.coverage.filled}/{entry.coverage.total}
                          </Badge>
                        )}
                        {missingSlots > 0 && (
                          <RoleNeedSummary entry={entry} />
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground flex gap-2 flex-wrap pl-5">
                      <span>
                        {formatDateShort(entry.startsAt, entry.allDay)}
                      </span>
                      {entry.sportCode && (
                        <span>{sportLabel(entry.sportCode)}</span>
                      )}
                      {titleParts.detail && (
                        <span>{titleParts.detail}</span>
                      )}
                      {entry.subtitle && (
                        <span className="font-medium text-primary/70">{entry.subtitle}</span>
                      )}
                      {entry.archivedAt && (
                        <span className="inline-flex items-center gap-0.5 text-muted-foreground/50">
                          <ArchiveIcon className="size-3" />
                          Archived
                        </span>
                      )}
                      <AssignmentAvatarGroup entry={entry} isExpanded={isExpanded} />
                    </div>
                  </button>

                  {isExpanded && entry.shifts.length > 0 && (
                    <div className="border-t border-border/40 px-4 py-3 pl-8">
                      <ShiftRowList
                        entry={entry}
                        isStaff={isStaff}
                        pickerUsers={filteredUsers}
                        pickerLoading={usersLoading}
                        pickerSearch={userSearch}
                        assigning={assigning}
                        onOpenPicker={(shiftId) => {
                          setUserSearch("");
                          loadUsers();
                        }}
                        onClosePicker={() => {
                          setUserSearch("");
                        }}
                        onPickerSearchChange={setUserSearch}
                        onInlineAssign={handleInlineAssign}
                        currentUserId={currentUserId}
                        postingTradeId={postingTradeId}
                        addingShiftId={addingShiftId}
                        onAddShift={(shift, workerType) => handleAddMatchingShift(entry, shift, workerType)}
                        removingAssignmentId={removingAssignmentId}
                        onRemoveAssignment={handleRemoveAssignment}
                        onPostTrade={isStaff ? undefined : openTradeDialog}
                        onSelectGroup={() => onSelectGroup(entry.shiftGroupId)}
                        compact
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          </>
        )}
      </div>

      <Dialog
        open={Boolean(tradeDialogAssignmentId)}
        onOpenChange={(open) => {
          if (!open) closeTradeDialog();
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <div className="space-y-1">
              <DialogTitle>Post shift for trade</DialogTitle>
              <DialogDescription>
                Add a short note so teammates understand the swap.
              </DialogDescription>
            </div>
          </DialogHeader>
          <div className="space-y-3 px-6 py-1">
            {tradeError && (
              <Alert variant="destructive" className="py-2.5">
                <AlertDescription>{tradeError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="schedule-trade-notes" className="text-xs font-medium">
                Notes <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="schedule-trade-notes"
                placeholder="e.g. Conflict with class, available all week"
                value={tradeNotes}
                onChange={(event) => {
                  setTradeNotes(event.target.value);
                  if (tradeError) setTradeError(null);
                }}
                className="min-h-24 resize-none text-sm"
                maxLength={5000}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeTradeDialog} disabled={Boolean(postingTradeId)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (tradeDialogAssignmentId) void handlePostTrade(tradeDialogAssignmentId, tradeNotes);
              }}
              disabled={Boolean(postingTradeId)}
            >
              {postingTradeId ? "Posting..." : "Post trade"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ── Event parent + shift child rows (desktop) ── */

function EventRows({
  entry,
  isExpanded,
  hasShifts,
  isAssignedToMe,
  shiftStatus,
  isStaff,
  isHiding,
  onToggle,
  onSelectGroup,
  onHide,
  pickerUsers,
  pickerLoading,
  pickerSearch,
  assigning,
  onOpenPicker,
  onClosePicker,
  onPickerSearchChange,
  onInlineAssign,
  currentUserId,
  showShiftStatus,
  postingTradeId,
  addingShiftId,
  onAddShift,
  removingAssignmentId,
  onRemoveAssignment,
  onPostTrade,
}: {
  entry: CalendarEntry;
  isExpanded: boolean;
  hasShifts: boolean;
  isAssignedToMe: boolean;
  shiftStatus: string | null;
  isStaff: boolean;
  isHiding: boolean;
  onToggle: () => void;
  onSelectGroup: () => void;
  onHide?: () => void;
  pickerUsers: PickerUser[];
  pickerLoading: boolean;
  pickerSearch: string;
  assigning: boolean;
  onOpenPicker: (shiftId: string) => void;
  onClosePicker: () => void;
  onPickerSearchChange: (value: string) => void;
  onInlineAssign: (shiftId: string, userId: string) => void;
  currentUserId: string;
  showShiftStatus: boolean;
  postingTradeId: string | null;
  addingShiftId: string | null;
  onAddShift?: (shift: Shift, workerType: ShiftWorkerKind) => void;
  removingAssignmentId: string | null;
  onRemoveAssignment?: (assignmentId: string) => void;
  onPostTrade?: (assignmentId: string) => void;
}) {
  const titleParts = scheduleEventTitleParts(entry);

  const callTime = entry.isHome === true && entry.shifts.length > 0
    ? formatTime(entry.shifts.reduce((min, s) => s.startsAt < min ? s.startsAt : min, entry.shifts[0]!.startsAt))
    : null;
  const missingSlots = missingSlotCount(entry);
  const needsCoverage = missingSlots > 0;

  const venueTone = VENUE_TONES[venueToneFromEvent(entry)];

  return (
    <>
      {/* Parent event row */}
      <tr
        className={cn(
          "group/row border-l-[3px] transition-colors",
          venueTone.railClass,
          hasShifts ? "cursor-pointer" : "",
          isExpanded
            ? "bg-muted/20"
            : needsCoverage
              ? "bg-[var(--red-bg)]/15 hover:bg-[var(--red-bg)]/25"
              : isAssignedToMe
                ? "bg-primary/5 hover:bg-primary/10"
                : "hover:bg-muted/10",
        )}
        onClick={hasShifts ? onToggle : undefined}
      >
        <td className="pl-3 pr-1 py-3 border-b border-border/20 w-7">
          {hasShifts && (
            <button
              type="button"
              aria-label={isExpanded ? "Collapse shifts" : "Expand shifts"}
              aria-expanded={isExpanded}
              className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-[background-color,color,scale] duration-150 hover:bg-muted hover:text-foreground active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
            >
              {isExpanded ? (
                <ChevronDownIcon className="size-4" />
              ) : (
                <ChevronRightIcon className="size-4" />
              )}
            </button>
          )}
        </td>
        <td className="px-4 py-3 border-b border-border/20">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-[11px] text-muted-foreground/60 tabular-nums shrink-0"
              style={{ fontFamily: entry.allDay ? "var(--font-heading)" : "var(--font-mono)" }}
            >
              {eventStartLabel(entry)}
            </span>
            <div className="min-w-[180px] max-w-full">
              <Link
                href={`/events/${entry.id}`}
                className="block truncate text-sm font-semibold hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {titleParts.title}
              </Link>
              {titleParts.detail && (
                <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                  {titleParts.detail}
                </span>
              )}
              {entry.subtitle && (
                <span className="mt-0.5 block truncate text-[11px] font-medium text-primary/70">
                  {entry.subtitle}
                </span>
              )}
            </div>
            {entry.coverage && (
              <CoveragePill
                percentage={entry.coverage.percentage}
                filled={entry.coverage.filled}
                total={entry.coverage.total}
              />
            )}
            {needsCoverage && (
              <span className="inline-flex h-5 items-center gap-1 rounded-full bg-[var(--red-bg)] px-1.5">
                <AlertTriangleIcon className="size-3" />
                <RoleNeedSummary entry={entry} />
              </span>
            )}
            {entry.isPremier && (
              <Badge variant="blue" size="sm">
                Premier
              </Badge>
            )}
            {showShiftStatus && shiftStatus === "Pending" && (
              <Badge
                variant="orange"
                size="sm"
              >
                {shiftStatus}
              </Badge>
            )}
            {entry.archivedAt && (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/50">
                <ArchiveIcon className="size-3" />
                Archived
              </span>
            )}
            <AssignmentAvatarGroup entry={entry} isExpanded={isExpanded} />
            {isStaff && onHide && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Hide event"
                    className={cn(
                      "opacity-0 transition-[background-color,color,opacity,scale] group-hover/row:opacity-100 focus-visible:opacity-100",
                      isHiding && "opacity-100",
                    )}
                    disabled={isHiding}
                    onClick={(e) => {
                      e.stopPropagation();
                      onHide();
                    }}
                  >
                    <EyeOffIcon className={cn("size-3.5", isHiding && "animate-pulse")} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Hide event from schedule</TooltipContent>
              </Tooltip>
            )}
          </div>
        </td>
        <td className="px-4 py-3 border-b border-border/20 whitespace-nowrap">
          {entry.isHome === true && callTime ? (
            <span className="text-sm text-muted-foreground tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
              {callWindowLabel(entry.shifts.reduce((min, s) => s.startsAt < min ? s.startsAt : min, entry.shifts[0]!.startsAt), entry.endsAt)}
            </span>
          ) : null}
        </td>
      </tr>

      {/* Expanded assignment detail */}
      {isExpanded && (
        <tr className="bg-muted/10">
          <td className="border-b border-border/15"></td>
          <td colSpan={2} className="border-b border-border/15 px-4 py-3">
            <div className="pl-5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Assignment detail
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 px-2 text-xs text-muted-foreground transition-[background-color,color,scale] hover:text-foreground active:scale-[0.96]"
                  onClick={onSelectGroup}
                >
                  Manage event
                </Button>
              </div>
              <ShiftRowList
                entry={entry}
                isStaff={isStaff}
                pickerUsers={pickerUsers}
                pickerLoading={pickerLoading}
                pickerSearch={pickerSearch}
                assigning={assigning}
                onOpenPicker={onOpenPicker}
                onClosePicker={onClosePicker}
                onPickerSearchChange={onPickerSearchChange}
                onInlineAssign={onInlineAssign}
                currentUserId={currentUserId}
                postingTradeId={postingTradeId}
                addingShiftId={addingShiftId}
                onAddShift={onAddShift}
                removingAssignmentId={removingAssignmentId}
                onRemoveAssignment={onRemoveAssignment}
                onPostTrade={onPostTrade}
                onSelectGroup={onSelectGroup}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
