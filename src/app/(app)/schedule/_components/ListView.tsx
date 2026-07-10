"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { ArchiveIcon, ChevronDownIcon, ChevronRightIcon, EyeOffIcon, UserIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { SkeletonTable } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import { formatDateShort, formatTimeShort } from "@/lib/format";
import { formatCalendarEventAllDayLabel, formatCalendarEventDateRange } from "@/lib/calendar-event-dates";
import { sportLabel } from "@/lib/sports";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { OperationalRowActions } from "@/components/OperationalRowActions";
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
import { CallWindowEditor } from "@/components/shift-detail/CallWindowEditor";
import { UserAvatarPicker, type PickerUser } from "@/components/shift-detail/UserAvatarPicker";
import { handleAuthRedirect, isAbortError, parseErrorMessage, parseJsonSafely } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { VENUE_TONES, venueToneFromEvent } from "@/lib/venue-tone";
import { formatRoleSlotAssignmentOutcome, shiftWorkerLabelForProfile, shiftWorkerSlotLabel, type RoleSlotOutcomeLike, type ShiftWorkerKind } from "@/lib/shift-display";
import { callWindowKey, effectiveCallWindow, formatCallWindowLabel, isInheritedFullDayCallWindow } from "@/lib/shift-call-windows";
import type { CalendarEntry, Shift } from "./types";
import type { ScheduleHealthSnapshot } from "@/lib/schedule-health-types";
import type { ScheduleChangeEventSummary } from "@/lib/schedule-change-history-types";
import type { ScheduleQueueMeta } from "@/lib/schedule-queues";
import {
  ACTIVE_STATUSES,
  AREA_LABELS,
  scheduleEventTitleParts,
  userHasShift,
  userShiftStatus,
} from "./types";
import { CoverageBadge } from "./Coverage";

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
  activeQueueMeta: ScheduleQueueMeta | null;
  clearQueue: () => void;
  currentUserId: string;
  isStaff: boolean;
  scheduleHealth: ScheduleHealthSnapshot | null;
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

const EVENT_GRID_CLASS = "grid-cols-[44px_72px_minmax(180px,1fr)_80px_136px_minmax(140px,180px)_40px]";

function shiftAssignee(shift: Shift) {
  const active = shift.assignments.find((a) => ACTIVE_STATUSES.includes(a.status));
  return active?.user ?? null;
}

function activeShiftAssignment(shift: Shift) {
  return shift.assignments.find((a) => ACTIVE_STATUSES.includes(a.status)) ?? null;
}

function workerKindForShift(shift: Shift): ShiftWorkerKind {
  return shift.workerType === "FT" ? "FT" : "ST";
}

function roleSlotLabel(kind: ShiftWorkerKind) {
  return shiftWorkerSlotLabel(kind);
}

function PublicationBadge({ entry, quietPublished = false }: { entry: CalendarEntry; quietPublished?: boolean }) {
  const state = entry.publication;
  if (!state) return null;
  if (!state.publishedAt) return null;
  if (state.changedAfterPublish) return <Badge variant="orange" size="sm">Unpublished changes</Badge>;
  if (state.unacknowledgedCount > 0) return <Badge variant="blue" size="sm">{state.unacknowledgedCount} unack</Badge>;
  if (quietPublished) return null;
  return <Badge variant="green" size="sm">Published</Badge>;
}

function ChangeHistoryBadge({
  summary,
  reviewOnly = false,
}: {
  summary?: ScheduleChangeEventSummary | null;
  reviewOnly?: boolean;
}) {
  if (!summary || summary.items.length === 0) return null;
  if (reviewOnly && !summary.needsReview) return null;
  if (!summary.needsReview) return null;
  return (
    <Badge variant="orange" size="sm">
      Review changes
    </Badge>
  );
}

function latestChangeLabel(summary?: ScheduleChangeEventSummary | null) {
  const latest = summary?.items[0];
  if (!latest) return null;
  const time = new Date(latest.createdAt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return `${latest.label} · ${time}`;
}

function eventStartLabel(entry: CalendarEntry) {
  return entry.allDay ? formatCalendarEventAllDayLabel(entry) : formatTimeShort(entry.startsAt);
}

function DateGroupHeader({ date, eventCount, isToday }: { date: Date; eventCount: number; isToday: boolean }) {
  const dateLabel = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="sticky top-0 z-10 flex min-h-10 items-center gap-2 border-b border-border/50 bg-background/95 px-3 backdrop-blur">
      <span className={cn("text-xs font-semibold", isToday ? "text-[var(--wi-red)]" : "text-foreground")}>
        {dateLabel}
      </span>
      {isToday && <Badge variant="red" size="sm">Today</Badge>}
      <span className="ml-auto text-xs font-medium tabular-nums text-muted-foreground">
        {eventCount} event{eventCount === 1 ? "" : "s"}
      </span>
    </div>
  );
}

function commonCallWindow(entry: CalendarEntry) {
  if (entry.allDay) return null;

  const counts = new Map<string, { count: number; window: ReturnType<typeof effectiveCallWindow> }>();
  for (const shift of entry.shifts) {
    const window = effectiveCallWindow(shift, activeShiftAssignment(shift));
    if (isInheritedFullDayCallWindow(window)) continue;
    const key = callWindowKey(window);
    const current = counts.get(key);
    counts.set(key, { count: (current?.count ?? 0) + 1, window });
  }

  const [mostCommon] = [...counts.entries()].sort((a, b) => b[1].count - a[1].count);
  if (!mostCommon || mostCommon[1].count < 2) return null;
  return { key: mostCommon[0], count: mostCommon[1].count, window: mostCommon[1].window };
}

function CrewSummary({
  entry,
  isStaff,
  onSelectGroup,
  compact = false,
}: {
  entry: CalendarEntry;
  isStaff: boolean;
  onSelectGroup?: () => void;
  compact?: boolean;
}) {
  const assignedUsers = entry.shifts
    .map(shiftAssignee)
    .filter((user): user is NonNullable<ReturnType<typeof shiftAssignee>> => Boolean(user));
  const openCount = entry.shifts.reduce((count, shift) => count + (shiftAssignee(shift) ? 0 : 1), 0);

  if (entry.shifts.length === 0) return null;

  return (
    <div className={cn("flex min-w-0 items-center gap-2", compact ? "justify-start" : "justify-end")}>
      {assignedUsers.length > 0 && <UserAvatarGroup users={assignedUsers} max={compact ? 3 : 4} />}
      {openCount > 0 && isStaff && onSelectGroup ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 shrink-0 px-2.5 text-xs transition-[background-color,scale] active:scale-[0.96]"
          onClick={(event) => {
            event.stopPropagation();
            onSelectGroup();
          }}
        >
          Assign {openCount}
        </Button>
      ) : openCount > 0 ? (
        <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
          {openCount} open
        </span>
      ) : assignedUsers.length === 0 ? (
        <span className="text-xs font-medium text-muted-foreground">No crew</span>
      ) : null}
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
  removingAssignmentId,
  onRemoveAssignment,
  onSelectGroup,
  onCallWindowSaved,
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
  removingAssignmentId: string | null;
  onRemoveAssignment?: (assignmentId: string) => void;
  onSelectGroup: () => void;
  onCallWindowSaved: () => void;
  compact?: boolean;
}) {
  const commonCall = commonCallWindow(entry);

  return (
    <div className={cn("flex flex-col", compact ? "gap-2" : "gap-1.5")}>
      {commonCall && (
        <div className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1 text-xs text-muted-foreground",
          compact ? "bg-muted/30" : "bg-muted/20",
        )}>
          <span className="font-medium text-foreground/70">Most rows</span>
          <span className="tabular-nums">{formatCallWindowLabel(commonCall.window)}</span>
        </div>
      )}
      {entry.shifts.map((shift) => {
        const activeAssignment = activeShiftAssignment(shift);
        const user = activeAssignment?.user ?? null;
        const myAssignment = shift.assignments.find(
          (a) => a.user.id === currentUserId && ACTIVE_STATUSES.includes(a.status),
        );
        const areaLabel = AREA_LABELS[shift.area] ?? shift.area;
        const workerType = workerKindForShift(shift);
        const slotLabel = roleSlotLabel(workerType);
        const assignedClassLabel = user ? shiftWorkerLabelForProfile(user) : null;
        const assignedClassDiffersFromSlot = Boolean(assignedClassLabel && `${assignedClassLabel} slot` !== slotLabel);
        const emptyAssignLabel = compact ? "Assign" : "Assign";
        const emptyAssignAriaLabel = `Assign open ${slotLabel.toLowerCase()} to ${areaLabel}`;
        const isRemovingAssignment = Boolean(activeAssignment && removingAssignmentId === activeAssignment.id);
        const slotWindow = effectiveCallWindow(shift);
        const assignmentWindow = activeAssignment ? effectiveCallWindow(shift, activeAssignment) : null;
        const visibleWindow = assignmentWindow ?? slotWindow;
        const callEditorTarget = activeAssignment
          ? { type: "assignment" as const, id: activeAssignment.id }
          : { type: "slot" as const, id: shift.id };
        const callEditorOverride = activeAssignment
          ? { startsAt: activeAssignment.callStartsAt ?? null, endsAt: activeAssignment.callEndsAt ?? null }
          : { startsAt: shift.callStartsAt ?? null, endsAt: shift.callEndsAt ?? null };
        const showCallWindows = !entry.allDay;
        const showStaffCallEditor = showCallWindows && !isInheritedFullDayCallWindow(visibleWindow);
        const callMatchesCommon = Boolean(commonCall && callWindowKey(visibleWindow) === commonCall.key);
        const showRowCallWindow = showStaffCallEditor && !callMatchesCommon;

        return (
          <div
            key={shift.id}
            className={cn(
              "min-h-11 border-border/45 px-2 py-1.5 transition-colors hover:bg-background/70",
              compact ? "flex flex-col gap-2 rounded-md border bg-background/50" : "grid grid-cols-[88px_minmax(0,1fr)_auto_auto] items-center gap-3 border-t first:border-t-0",
            )}
          >
            <div className="flex min-w-0 items-center">
              <Badge
                variant={AREA_BADGE_VARIANT[shift.area] ?? "gray"}
                size="sm"
              >
                {areaLabel}
              </Badge>
            </div>

            <div className="min-w-0 flex-1">
              {user ? (
                <div className="group/assignment flex min-h-10 w-full items-center rounded-md px-2 transition-[background-color] hover:bg-muted/45 focus-within:bg-muted/45">
                  <button
                    type="button"
                    className="inline-flex min-w-0 flex-1 items-center gap-2 rounded-md text-left transition-[scale] active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
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
                    {!compact && assignedClassDiffersFromSlot && (
                      <span className="ml-1 shrink-0 text-xs text-muted-foreground">
                        {assignedClassLabel}
                      </span>
                    )}
                  </button>
                  {isStaff && activeAssignment && onRemoveAssignment && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="relative ml-1 size-8 text-muted-foreground transition-[background-color,color,scale] before:absolute before:-inset-1 before:content-[''] hover:text-destructive active:scale-[0.96]"
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
                  {compact && assignedClassDiffersFromSlot && (
                    <span className="ml-auto shrink-0 text-xs font-medium text-muted-foreground">
                      {assignedClassLabel}
                    </span>
                  )}
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
                      className="group flex min-h-10 w-full items-center gap-2 rounded-md bg-muted/25 px-2 text-left transition-[background-color,scale] hover:bg-muted/45 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
                      disabled={assigning}
                      aria-label={emptyAssignAriaLabel}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-background/70 text-muted-foreground shadow-[inset_0_0_0_1px_hsl(var(--border)/0.55)]">
                        <UserIcon className="size-3 opacity-70" />
                      </div>
                      <span className="min-w-0 truncate text-sm font-medium text-muted-foreground group-hover:text-foreground">
                        {emptyAssignLabel}
                      </span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                        {slotLabel}
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
                      slotWorkerType={workerType}
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

            {compact ? (
              <div className="flex min-w-0 flex-col items-start gap-1">
                {isStaff && showRowCallWindow ? (
                  <CallWindowEditor
                    target={callEditorTarget}
                    effectiveWindow={visibleWindow}
                    overrideWindow={callEditorOverride}
                    onSaved={onCallWindowSaved}
                    disabled={Boolean(removingAssignmentId)}
                    compact
                  />
                ) : showCallWindows && !isInheritedFullDayCallWindow(visibleWindow) && !callMatchesCommon ? (
                  <CallWindowEditor
                    effectiveWindow={visibleWindow}
                    compact
                  />
                ) : null}
              </div>
            ) : (
              <div className="flex min-h-10 min-w-0 flex-col items-end justify-center gap-1">
                {isStaff && showRowCallWindow ? (
                  <CallWindowEditor
                    target={callEditorTarget}
                    effectiveWindow={visibleWindow}
                    overrideWindow={callEditorOverride}
                    onSaved={onCallWindowSaved}
                    disabled={Boolean(removingAssignmentId)}
                    compact
                  />
                ) : showCallWindows && !isInheritedFullDayCallWindow(visibleWindow) && !callMatchesCommon ? (
                  <CallWindowEditor
                    effectiveWindow={visibleWindow}
                    compact
                  />
                ) : null}
              </div>
            )}

            <div className={cn("flex min-h-9", compact ? "justify-start" : "shrink-0 justify-end")}>
              <div className={cn("flex min-w-0 items-center gap-1.5", compact && "flex-wrap")}>
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
  activeQueueMeta,
  clearQueue,
  currentUserId,
  isStaff,
  scheduleHealth,
  expandedRowId,
  setExpandedRowId,
  onSelectGroup,
  hidingEventIds,
  onHideEvent,
}: ListViewProps) {

  // Scroll to today when includePast is toggled on and data has loaded
  const desktopTodayGroupRef = useRef<HTMLDivElement>(null);
  const mobileTodayGroupRef = useRef<HTMLDivElement>(null);
  const didScrollRef = useRef(false);
  useEffect(() => {
    if (!includePast) { didScrollRef.current = false; return; }
    const todayGroupRef = window.matchMedia("(max-width: 1023px)").matches
      ? mobileTodayGroupRef
      : desktopTodayGroupRef;
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
        const json = await parseJsonSafely<{ data?: PickerUser[] }>(res);
        if (!Array.isArray(json?.data)) {
          usersLoadedRef.current = false;
          toast.error("Failed to load users");
          return;
        }
        setAllUsers(json.data ?? []);
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
        const selectedUser = allUsers.find((user) => user.id === userId);
        const json = await parseJsonSafely<{ meta?: { roleSlotOutcome?: RoleSlotOutcomeLike } }>(res);
        setUserSearch("");
        loadData();
        toast.success(formatRoleSlotAssignmentOutcome(json?.meta?.roleSlotOutcome, selectedUser?.name));
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
  }, [allUsers, loadData]);

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

  return (
    <>
      <div className="overflow-hidden rounded-md border border-border/60 bg-card">
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/15 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              {myShiftsOnly ? "My Shifts" : includePast ? "All Events" : "Upcoming Events"}
            </h3>
            <span className="text-xs font-medium tabular-nums text-muted-foreground">
              {filteredEntries.length !== entries.length
                ? `${filteredEntries.length} of ${entries.length}`
                : filteredEntries.length}
            </span>
          </div>
        </div>

        <div className={cn("hidden min-h-9 items-center gap-2 border-b border-border/50 bg-muted/10 px-2 text-[11px] font-medium text-muted-foreground lg:grid", EVENT_GRID_CLASS)}>
          <span aria-hidden="true" />
          <span>Time</span>
          <span>Event</span>
          <span>Coverage</span>
          <span>Status</span>
          <span className="text-right">Crew</span>
          <span className="sr-only">Actions</span>
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
            title={activeQueueMeta ? activeQueueMeta.emptyTitle : myShiftsOnly ? "No shifts assigned" : "No events found"}
            description={
              activeQueueMeta
                ? activeQueueMeta.emptyDescription
                : myShiftsOnly
                ? "You don't have any upcoming shift assignments."
                : hasFilters
                  ? "Try adjusting your filters."
                  : "No upcoming events. Check Settings > Calendar Sources to add an ICS feed."
            }
            actionLabel={
              activeQueueMeta
                ? "Show full schedule"
                : myShiftsOnly
                ? "Show all events"
                : hasFilters
                  ? "Clear filters"
                  : "Calendar Sources"
            }
            actionHref={
              activeQueueMeta || myShiftsOnly
                ? undefined
                : hasFilters
                  ? undefined
                  : "/settings/calendar-sources"
            }
            onAction={
              activeQueueMeta
                ? clearQueue
                : myShiftsOnly ? () => setMyShiftsOnly(false) : hasFilters ? clearFilters : undefined
            }
          />
        ) : (
          <>
            {/* ── Desktop: timeline table ── */}
            <div className="max-lg:hidden">
              {groupedEntries.map(([dateKey, groupEntries], groupIdx) => {
                const groupDate = new Date(dateKey);
                const isGroupToday =
                  groupDate.toDateString() === new Date().toDateString();

              return (
                <div key={`${dateKey}-${groupIdx}`} ref={isGroupToday ? desktopTodayGroupRef : undefined}>
                  <DateGroupHeader date={groupDate} eventCount={groupEntries.length} isToday={isGroupToday} />

                  <table className="w-full border-collapse">
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
                            onOpenPicker={() => {
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
                            changeEvent={scheduleHealth?.changeHistory.events[entry.id] ?? null}
                            removingAssignmentId={removingAssignmentId}
                            onRemoveAssignment={handleRemoveAssignment}
                            onCallWindowSaved={loadData}
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
          <div className="hidden max-lg:flex flex-col">
            {groupedEntries.map(([dateKey, groupEntries], groupIdx) => {
              const groupDate = new Date(dateKey);
              const isGroupToday = groupDate.toDateString() === new Date().toDateString();

              return (
                <div key={`${dateKey}-${groupIdx}`} ref={isGroupToday ? mobileTodayGroupRef : undefined}>
                  <DateGroupHeader date={groupDate} eventCount={groupEntries.length} isToday={isGroupToday} />
                  {groupEntries.map((entry) => {
              const isExpanded = expandedRowId === entry.id;
              const isAssignedToMe = currentUserId ? userHasShift(entry, currentUserId) : false;
              const shiftStatus = currentUserId
                ? userShiftStatus(entry, currentUserId)
                : null;
              const titleParts = scheduleEventTitleParts(entry);

              const venueTone = VENUE_TONES[venueToneFromEvent(entry)];
              const changeEvent = scheduleHealth?.changeHistory.events[entry.id] ?? null;

              return (
                <div
                  key={entry.id}
                  className={cn(
                    "relative border-b border-border/50 last:border-b-0",
                    isAssignedToMe && "bg-primary/5",
                  )}
                >
                  <button
                    className="w-full px-4 py-3 pr-14 text-left"
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
                        {myShiftsOnly && shiftStatus === "Pending" && (
                          <Badge
                            variant="orange"
                            size="sm"
                          >
                            {shiftStatus}
                          </Badge>
                        )}
                        {entry.coverage && (
                          <CoverageBadge
                            percentage={entry.coverage.percentage}
                            filled={entry.coverage.filled}
                            total={entry.coverage.total}
                          />
                        )}
                        {isStaff && <ChangeHistoryBadge summary={changeEvent} reviewOnly />}
                        <PublicationBadge entry={entry} quietPublished />
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground flex gap-2 flex-wrap pl-5">
                      <span>
                        {entry.allDay
                          ? formatCalendarEventDateRange(entry)
                          : formatDateShort(entry.startsAt, entry.allDay)}
                      </span>
                      {entry.sportCode && (
                        <span>{sportLabel(entry.sportCode)}</span>
                      )}
                      {titleParts.detail && (
                        <span>{titleParts.detail}</span>
                      )}
                      <span>{venueTone.label}</span>
                      {entry.subtitle && (
                        <span className="font-medium text-primary/70">{entry.subtitle}</span>
                      )}
                      {entry.archivedAt && (
                        <span className="inline-flex items-center gap-0.5 text-muted-foreground/50">
                          <ArchiveIcon className="size-3" />
                          Archived
                        </span>
                      )}
                      <CrewSummary entry={entry} isStaff={isStaff} compact />
                    </div>
                  </button>

                  {isStaff && onHideEvent && (
                    <div className="absolute right-2 top-2">
                      <OperationalRowActions label={`Actions for ${titleParts.title}`}>
                        <DropdownMenuItem
                          disabled={hidingEventIds?.has(entry.id) ?? false}
                          onSelect={() => onHideEvent(entry.id)}
                        >
                          <EyeOffIcon className="size-4" />
                          Hide event
                        </DropdownMenuItem>
                      </OperationalRowActions>
                    </div>
                  )}

                  {isExpanded && entry.shifts.length > 0 && (
                    <div className="border-t border-border/40 px-4 py-3 pl-8">
                      {isStaff && latestChangeLabel(changeEvent) && (
                        <div className="mb-2 text-xs text-muted-foreground">
                          {latestChangeLabel(changeEvent)}
                        </div>
                      )}
                      <ShiftRowList
                        entry={entry}
                        isStaff={isStaff}
                        pickerUsers={filteredUsers}
                        pickerLoading={usersLoading}
                        pickerSearch={userSearch}
                        assigning={assigning}
                        onOpenPicker={() => {
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
                        removingAssignmentId={removingAssignmentId}
                        onRemoveAssignment={handleRemoveAssignment}
                        onCallWindowSaved={loadData}
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
  changeEvent,
  removingAssignmentId,
  onRemoveAssignment,
  onCallWindowSaved,
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
  changeEvent?: ScheduleChangeEventSummary | null;
  removingAssignmentId: string | null;
  onRemoveAssignment?: (assignmentId: string) => void;
  onCallWindowSaved: () => void;
  onPostTrade?: (assignmentId: string) => void;
}) {
  const titleParts = scheduleEventTitleParts(entry);

  const venueTone = VENUE_TONES[venueToneFromEvent(entry)];

  return (
    <>
      {/* Parent event row */}
      <tr
        className={cn(
          "group/row transition-colors",
          hasShifts ? "cursor-pointer" : "",
          isExpanded
            ? "bg-muted/20"
            : isAssignedToMe
              ? "bg-primary/5 hover:bg-primary/10"
              : "hover:bg-muted/10",
        )}
        onClick={hasShifts ? onToggle : undefined}
      >
        <td className="border-b border-border/20 px-2 py-1.5">
          <div className={cn("grid min-h-12 items-center gap-2", EVENT_GRID_CLASS)}>
            <div>
              {hasShifts && (
                <button
                  type="button"
                  aria-label={isExpanded ? "Collapse shifts" : "Expand shifts"}
                  aria-expanded={isExpanded}
                  className="relative flex size-10 items-center justify-center rounded-md text-muted-foreground transition-[background-color,color,scale] hover:bg-muted hover:text-foreground active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggle();
                  }}
                >
                  {isExpanded ? <ChevronDownIcon className="size-4" /> : <ChevronRightIcon className="size-4" />}
                </button>
              )}
            </div>
            <span
              className="shrink-0 text-[11px] tabular-nums text-muted-foreground"
              style={{ fontFamily: entry.allDay ? "var(--font-heading)" : "var(--font-mono)" }}
            >
              {eventStartLabel(entry)}
            </span>
            <div className="min-w-0">
              <Link
                href={`/events/${entry.id}`}
                className="block truncate text-sm font-semibold hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {titleParts.title}
              </Link>
              <div className="mt-0.5 flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground">
                <span className="shrink-0">{venueTone.label}</span>
                {titleParts.detail && <span className="truncate">{titleParts.detail}</span>}
                {entry.subtitle && <span className="truncate font-medium text-primary/70">{entry.subtitle}</span>}
              </div>
            </div>
            <div>{entry.coverage && <CoverageBadge percentage={entry.coverage.percentage} filled={entry.coverage.filled} total={entry.coverage.total} />}</div>
            <div className="flex min-w-0 flex-wrap items-center gap-1">
              <PublicationBadge entry={entry} quietPublished />
              {isStaff && <ChangeHistoryBadge summary={changeEvent} reviewOnly />}
              {showShiftStatus && shiftStatus === "Pending" && <Badge variant="orange" size="sm">{shiftStatus}</Badge>}
              {entry.archivedAt && (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60">
                  <ArchiveIcon className="size-3" />
                  Archived
                </span>
              )}
            </div>
            <CrewSummary entry={entry} isStaff={isStaff} onSelectGroup={onSelectGroup} />
            {isStaff && onHide ? (
              <OperationalRowActions label={`Actions for ${titleParts.title}`} triggerClassName={isHiding ? "opacity-100" : undefined}>
                <DropdownMenuItem disabled={isHiding} onSelect={onHide}>
                  <EyeOffIcon className="size-4" />
                  Hide event
                </DropdownMenuItem>
              </OperationalRowActions>
            ) : (
              <span aria-hidden="true" />
            )}
          </div>
        </td>
      </tr>

      {/* Expanded assignment detail */}
      {isExpanded && (
        <tr className="bg-muted/10">
          <td className="border-b border-border/15 px-4 py-3">
            <div className="pl-[116px] pr-10">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Crew
                  </span>
                  {isStaff && latestChangeLabel(changeEvent) && (
                    <span className="truncate text-xs text-muted-foreground">
                      {latestChangeLabel(changeEvent)}
                    </span>
                  )}
                </div>
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
                removingAssignmentId={removingAssignmentId}
                onRemoveAssignment={onRemoveAssignment}
                onPostTrade={onPostTrade}
                onSelectGroup={onSelectGroup}
                onCallWindowSaved={onCallWindowSaved}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
