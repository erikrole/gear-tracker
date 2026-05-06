"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { AlertTriangleIcon, ArchiveIcon, ChevronDownIcon, ChevronRightIcon, EyeOffIcon, UserIcon } from "lucide-react";
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
import { AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
import { UserAvatarPicker, type PickerUser } from "@/components/shift-detail/UserAvatarPicker";
import { handleAuthRedirect, isAbortError, parseErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import type { CalendarEntry, Shift } from "./types";
import {
  ACTIVE_STATUSES,
  AREA_LABELS,
  coverageVariant,
  formatTime,
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
  includePast: boolean;
  hasFilters: boolean;
  currentUserId: string;
  isStaff: boolean;
  expandedRowId: string | null;
  setExpandedRowId: (id: string | null) => void;
  onSelectGroup: (groupId: string | null) => void;
  onHideEvent?: (eventId: string) => void;
};

const AREA_BADGE_VARIANT: Record<string, "green" | "purple" | "orange" | "blue"> = {
  VIDEO: "green",
  PHOTO: "purple",
  COMMS: "orange",
  GRAPHICS: "blue",
};

type RoleTone = "staff" | "student";

function shiftAssignee(shift: Shift) {
  const active = shift.assignments.find((a) => ACTIVE_STATUSES.includes(a.status));
  return active?.user ?? null;
}

function missingSlotCount(entry: CalendarEntry) {
  if (!entry.coverage) return 0;
  return Math.max(entry.coverage.total - entry.coverage.filled, 0);
}

function isShiftOpen(shift: Shift) {
  return !shift.assignments.some((a) => ACTIVE_STATUSES.includes(a.status));
}

function roleToneFromWorkerType(workerType: string): RoleTone {
  return workerType === "ST" ? "student" : "staff";
}

function roleToneFromUserRole(role: string): RoleTone {
  return role === "STUDENT" ? "student" : "staff";
}

function roleLabel(tone: RoleTone) {
  return tone === "student" ? "Student" : "Staff";
}

function roleSlotLabel(workerType: string) {
  return `${roleLabel(roleToneFromWorkerType(workerType))} slot`;
}

function openRoleNeeds(entry: CalendarEntry) {
  return entry.shifts.reduce(
    (counts, shift) => {
      if (!isShiftOpen(shift)) return counts;
      counts[roleToneFromWorkerType(shift.workerType)] += 1;
      return counts;
    },
    { staff: 0, student: 0 },
  );
}

function roleNeedText(tone: RoleTone, count: number) {
  if (tone === "staff") return `${count} staff`;
  return `${count} student${count === 1 ? "" : "s"}`;
}

function RoleNeedSummary({ entry, compact = false }: { entry: CalendarEntry; compact?: boolean }) {
  const needs = openRoleNeeds(entry);
  const parts = (["staff", "student"] as const).filter((tone) => needs[tone] > 0);

  if (parts.length === 0) return null;

  return (
    <span className={cn("inline-flex items-center gap-1", compact && "text-[11px]")}>
      <span className="font-semibold text-[var(--red-text)]">
        Needs
      </span>
      <span className="font-semibold text-muted-foreground">
        {parts.map((tone) => roleNeedText(tone, needs[tone])).join(", ")}
      </span>
    </span>
  );
}

function eventStartLabel(entry: CalendarEntry) {
  return entry.allDay ? "All day" : formatTimeShort(entry.startsAt);
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
  return `${formatTime(shift.startsAt)} – ${formatTime(shift.endsAt)}`;
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
  const visibleUsers = assignedUsers.slice(0, 4);
  const extraCount = assignedUsers.length - visibleUsers.length;

  if (entry.shifts.length === 0) return null;

  return (
    <div
      className={cn(
        "ml-auto flex items-center gap-2 transition-[opacity,scale] duration-150",
        isExpanded ? "pointer-events-none opacity-0 scale-95" : "opacity-100 scale-100",
      )}
      aria-hidden={isExpanded}
    >
      <AvatarGroup aria-label={`${assignedUsers.length} assigned people`}>
        {visibleUsers.map((user) => (
          <UserAvatar
            key={user.id}
            name={user.name}
            avatarUrl={user.avatarUrl}
            size="sm"
            className="border-2 border-background shadow-sm"
          />
        ))}
        {extraCount > 0 && (
          <AvatarGroupCount>
            +{extraCount}
          </AvatarGroupCount>
        )}
      </AvatarGroup>
      {assignedUsers.length === 0 && (
        <span className="text-[11px] font-medium text-muted-foreground">
          No assignments
        </span>
      )}
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
  onSelectGroup: () => void;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col", compact ? "gap-2" : "gap-1.5")}>
      {entry.shifts.map((shift) => {
        const user = shiftAssignee(shift);
        const myAssignment = shift.assignments.find(
          (a) => a.user.id === currentUserId && ACTIVE_STATUSES.includes(a.status),
        );
        const shiftTime = formatShiftWindow(entry, shift);
        const areaLabel = AREA_LABELS[shift.area] ?? shift.area;
        const assignedLabel = user ? user.name : "Unassigned";
        const slotLabel = roleSlotLabel(shift.workerType);

        return (
          <div
            key={shift.id}
            className={cn(
              "min-h-12 rounded-md border border-border/40 bg-background/65 px-3 py-2 shadow-[0_1px_0_rgba(255,255,255,0.04)] transition-[background-color,border-color]",
              compact ? "flex flex-col gap-2" : "flex items-center gap-3",
            )}
          >
            <div className={cn("flex min-w-0 items-center gap-2", !compact && "w-28 shrink-0")}>
              <Badge
                variant={AREA_BADGE_VARIANT[shift.area] ?? "gray"}
                size="sm"
              >
                {areaLabel}
              </Badge>
            </div>

            <div className="min-w-0 flex-1">
              {user ? (
                <button
                  type="button"
                  className="flex min-h-9 w-full items-center gap-2 rounded-md px-1 text-left transition-[background-color,scale] hover:bg-muted/45 active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
                  aria-label={`Open ${areaLabel} shift assigned to ${user.name}`}
                  onClick={onSelectGroup}
                >
                  <UserAvatar
                    name={user.name}
                    avatarUrl={user.avatarUrl}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {user.name}
                  </span>
                  <span className="shrink-0 text-xs font-medium text-muted-foreground">
                    {roleLabel(roleToneFromUserRole(user.role))}
                  </span>
                </button>
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
                      className="flex min-h-9 w-full items-center gap-2 rounded-md border border-dashed border-muted-foreground/25 px-2 text-left transition-[background-color,border-color,scale] hover:border-muted-foreground/45 hover:bg-muted/45 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
                      disabled={assigning}
                      aria-label={`Assign ${areaLabel} ${slotLabel.toLowerCase()}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex size-6 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-muted-foreground/35 text-muted-foreground">
                        <UserIcon className="size-3 opacity-70" />
                      </div>
                      <span className="min-w-0 truncate text-sm font-medium text-muted-foreground">
                        Assign {slotLabel.toLowerCase()}
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
                  className="flex min-h-9 w-full items-center gap-2 rounded-md px-1 text-left transition-[background-color,scale] hover:bg-muted/45 active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
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

            <div className={cn("flex min-h-7", compact ? "justify-start" : "w-24 shrink-0 justify-end")}>
              {onPostTrade && myAssignment && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 px-2 text-xs text-muted-foreground transition-[background-color,color,scale] hover:text-foreground active:scale-[0.96]"
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
  includePast,
  hasFilters,
  currentUserId,
  isStaff,
  expandedRowId,
  setExpandedRowId,
  onSelectGroup,
  onHideEvent,
}: ListViewProps) {

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
  const coverageGaps = useMemo(() => {
    let events = 0;
    let slots = 0;
    for (const entry of filteredEntries) {
      const missing = missingSlotCount(entry);
      if (missing > 0) {
        events += 1;
        slots += missing;
      }
    }
    return { events, slots };
  }, [filteredEntries]);

  const handlePostTrade = useCallback(async (assignmentId: string) => {
    if (postingTradeRef.current) return;
    postingTradeRef.current = assignmentId;
    setPostingTradeId(assignmentId);
    try {
      const res = await fetch("/api/shift-trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shiftAssignmentId: assignmentId }),
      });
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        toast.success("Shift posted to trade board");
        loadData();
      } else {
        const msg = await parseErrorMessage(res, "Failed to post trade");
        toast.error(msg);
      }
    } catch {
      toast.error("Network error — could not post trade");
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
      } else {
        const msg = await parseErrorMessage(res, "Failed to assign shift");
        toast.error(msg);
      }
    } catch {
      toast.error("Network error — could not assign shift");
    }
    finally {
      assigningRef.current = false;
      setAssigning(false);
    }
  }, [loadData]);

  return (
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
          {coverageGaps.slots > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--red-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--red-text)]">
              <AlertTriangleIcon className="size-3" />
              <span className="tabular-nums">{coverageGaps.slots}</span>
              open slot{coverageGaps.slots !== 1 ? "s" : ""}
              <span className="text-[var(--red-text)]/70">
                across {coverageGaps.events}
              </span>
            </span>
          )}
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
                : "No upcoming events. Check Settings → Calendar Sources to add an ICS feed."
          }
          actionLabel={
            myShiftsOnly
              ? "Show all events"
              : hasFilters
                ? undefined
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
            myShiftsOnly ? () => setMyShiftsOnly(false) : undefined
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
                <div key={dateKey}>
                  {/* Date group header — timeline style */}
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
                        const shiftStatus = currentUserId
                          ? userShiftStatus(entry, currentUserId)
                          : null;

                        return (
                          <EventRows
                            key={entry.id}
                            entry={entry}
                            isExpanded={isExpanded}
                            hasShifts={hasShifts}
                            shiftStatus={shiftStatus}
                            isStaff={isStaff}
                            onToggle={() =>
                              setExpandedRowId(isExpanded ? null : entry.id)
                            }
                            onSelectGroup={() =>
                              onSelectGroup(entry.shiftGroupId)
                            }
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
                            postingTradeId={postingTradeId}
                            onPostTrade={isStaff ? undefined : handlePostTrade}
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
              const shiftStatus = currentUserId
                ? userShiftStatus(entry, currentUserId)
                : null;

              const barColor =
                entry.isHome === true
                  ? "border-l-[var(--green)]"
                  : entry.isHome === false
                    ? "border-l-[var(--orange)]"
                    : "border-l-muted-foreground/20";
              const missingSlots = missingSlotCount(entry);

              return (
                <div
                  key={entry.id}
                  className={cn(
                    "border-b border-border/50 last:border-b-0 border-l-[3px]",
                    barColor,
                    missingSlots > 0 && "bg-[var(--red-bg)]/15",
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
                        {entry.opponent
                          ? `${entry.isHome === false ? "at " : "vs "}${entry.opponent}`
                          : entry.summary}
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
                        {shiftStatus && (
                          <Badge
                            variant={shiftStatus === "Confirmed" ? "blue" : "orange"}
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
                        {formatDateShort(entry.startsAt)}
                      </span>
                      {entry.sportCode && (
                        <span>{sportLabel(entry.sportCode)}</span>
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
                        onPostTrade={isStaff ? undefined : handlePostTrade}
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
  );
}

/* ── Event parent + shift child rows (desktop) ── */

function EventRows({
  entry,
  isExpanded,
  hasShifts,
  shiftStatus,
  isStaff,
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
  postingTradeId,
  onPostTrade,
}: {
  entry: CalendarEntry;
  isExpanded: boolean;
  hasShifts: boolean;
  shiftStatus: string | null;
  isStaff: boolean;
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
  postingTradeId: string | null;
  onPostTrade?: (assignmentId: string) => void;
}) {
  const eventTitle = entry.opponent
    ? `${entry.sportCode ? sportLabel(entry.sportCode) + " " : ""}${entry.isHome === true ? "vs " : "at "}${entry.opponent}`
    : entry.summary;

  const callTime = entry.isHome === true && entry.shifts.length > 0
    ? formatTime(entry.shifts.reduce((min, s) => s.startsAt < min ? s.startsAt : min, entry.shifts[0]!.startsAt))
    : null;
  const missingSlots = missingSlotCount(entry);
  const needsCoverage = missingSlots > 0;

  const borderBar =
    entry.isHome === true
      ? "border-l-[var(--green)]"
      : entry.isHome === false
        ? "border-l-[var(--orange)]"
        : "border-l-transparent";

  return (
    <>
      {/* Parent event row */}
      <tr
        className={cn(
          "group/row border-l-[3px] transition-colors",
          borderBar,
          hasShifts ? "cursor-pointer" : "",
          isExpanded
            ? "bg-muted/20"
            : needsCoverage
              ? "bg-[var(--red-bg)]/15 hover:bg-[var(--red-bg)]/25"
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
              className="flex size-7 items-center justify-center rounded text-muted-foreground transition-[background-color,color,scale] duration-150 hover:bg-muted hover:text-foreground active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
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
            <Link
              href={`/events/${entry.id}`}
              className="font-semibold text-sm hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {eventTitle}
            </Link>
            {entry.coverage && (
              <CoveragePill
                percentage={entry.coverage.percentage}
                filled={entry.coverage.filled}
                total={entry.coverage.total}
              />
            )}
            {needsCoverage && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--red-bg)] px-2 py-0.5">
                <AlertTriangleIcon className="size-3" />
                <RoleNeedSummary entry={entry} />
              </span>
            )}
            {entry.isPremier && (
              <Badge variant="blue" size="sm">
                Premier
              </Badge>
            )}
            {shiftStatus && (
              <Badge
                variant={shiftStatus === "Confirmed" ? "blue" : "orange"}
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
                    className="opacity-0 group-hover/row:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      onHide();
                    }}
                  >
                    <EyeOffIcon className="size-3.5" />
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
              {`Call ${callTime}–${formatTime(entry.endsAt)}`}
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
                  className="h-7 px-2 text-xs text-muted-foreground transition-[background-color,color,scale] hover:text-foreground active:scale-[0.96]"
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
