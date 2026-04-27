"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { ArchiveIcon, ChevronDownIcon, ChevronRightIcon, EyeOffIcon, UserIcon } from "lucide-react";
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
import { UserAvatarPicker, type PickerUser } from "@/components/shift-detail/UserAvatarPicker";
import { handleAuthRedirect, isAbortError, parseErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import type { CalendarEntry, Shift } from "./types";
import {
  ACTIVE_STATUSES,
  AREA_LABELS,
  coverageVariant,
  formatDate,
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

/* Left-bar color per home/away */
const rowBarClass = (entry: CalendarEntry) =>
  entry.isHome === true
    ? "border-l-[var(--green)]"
    : entry.isHome === false
      ? "border-l-[var(--orange)]"
      : "border-l-transparent";

function shiftAssignee(shift: Shift) {
  const active = shift.assignments.find((a) => ACTIVE_STATUSES.includes(a.status));
  return active?.user ?? null;
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
  const [pickerShiftId, setPickerShiftId] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<PickerUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const usersLoadedRef = useRef(false);
  const [userSearch, setUserSearch] = useState("");
  const [assigning, setAssigning] = useState(false);
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

  const handlePostTrade = useCallback(async (assignmentId: string) => {
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
      setPostingTradeId(null);
    }
  }, [loadData]);

  const handleInlineAssign = useCallback(async (shiftId: string, userId: string) => {
    setAssigning(true);
    try {
      const res = await fetch("/api/shift-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shiftId, userId }),
      });
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        setPickerShiftId(null);
        setUserSearch("");
        loadData();
      } else {
        const msg = await parseErrorMessage(res, "Failed to assign shift");
        toast.error(msg);
      }
    } catch {
      toast.error("Network error — could not assign shift");
    }
    finally { setAssigning(false); }
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
                          Time
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
                            pickerShiftId={pickerShiftId}
                            pickerUsers={filteredUsers}
                            pickerLoading={usersLoading}
                            pickerSearch={userSearch}
                            assigning={assigning}
                            onOpenPicker={(shiftId) => {
                              setPickerShiftId(shiftId);
                              setUserSearch("");
                              loadUsers();
                            }}
                            onClosePicker={() => {
                              setPickerShiftId(null);
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
                  ? "border-l-emerald-500"
                  : entry.isHome === false
                    ? "border-l-amber-500"
                    : "border-l-muted-foreground/20";

              return (
                <div
                  key={entry.id}
                  className={cn(
                    "border-b border-border/50 last:border-b-0 border-l-[3px]",
                    barColor,
                  )}
                >
                  <button
                    className="w-full text-left px-4 py-3"
                    onClick={() =>
                      entry.shifts.length > 0
                        ? setExpandedRowId(isExpanded ? null : entry.id)
                        : undefined
                    }
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
                        {!entry.allDay && (
                          <span
                            className="text-[10px] text-muted-foreground/60 tabular-nums font-normal shrink-0"
                            style={{ fontFamily: "var(--font-mono)" }}
                          >
                            {formatTimeShort(entry.startsAt)}
                          </span>
                        )}
                        {entry.opponent
                          ? `${entry.isHome === false ? "at " : "vs "}${entry.opponent}`
                          : entry.summary}
                      </span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {(() => {
                          const mobileCallTime = entry.shifts.length > 0
                            ? formatTime(entry.shifts.reduce((min, s) => s.startsAt < min ? s.startsAt : min, entry.shifts[0].startsAt))
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
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground flex gap-2 flex-wrap pl-5">
                      <span>
                        {formatDateShort(entry.startsAt)}
                        {entry.allDay && " All day"}
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
                    </div>
                  </button>

                  {isExpanded && entry.shifts.length > 0 && (
                    <div className="border-t border-border/40">
                      {entry.shifts.map((shift) => {
                        const user = shiftAssignee(shift);
                        return (
                          <div
                            key={shift.id}
                            className="flex items-center gap-3 px-4 py-2.5 pl-8 border-b border-border/30 last:border-b-0 cursor-pointer hover:bg-muted/30 transition-colors focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-[-2px]"
                            tabIndex={0}
                            role="link"
                            onClick={() => onSelectGroup(entry.shiftGroupId)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                onSelectGroup(entry.shiftGroupId);
                              }
                            }}
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {user ? (
                                <>
                                  <UserAvatar
                                    name={user.name}
                                    avatarUrl={user.avatarUrl}
                                  />
                                  <span className="text-sm truncate">{user.name}</span>
                                </>
                              ) : (
                                <>
                                  <div className="size-6 rounded-full border-[1.5px] border-dashed border-muted-foreground/30 flex items-center justify-center shrink-0">
                                    <UserIcon className="size-3 text-muted-foreground/40" />
                                  </div>
                                  <span className="text-sm text-muted-foreground">
                                    Unassigned
                                  </span>
                                </>
                              )}
                            </div>
                            <Badge
                              variant={AREA_BADGE_VARIANT[shift.area] ?? "gray"}
                              size="sm"
                            >
                              {AREA_LABELS[shift.area] ?? shift.area}
                            </Badge>
                            {shift.workerType === "FT" && (
                              <Badge variant="gray" size="sm">FT</Badge>
                            )}
                          </div>
                        );
                      })}
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
  pickerShiftId,
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
  pickerShiftId: string | null;
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

  const timeStr = entry.allDay
    ? "All day"
    : `${formatTime(entry.startsAt)} – ${formatTime(entry.endsAt)}`;

  const callTime = entry.shifts.length > 0
    ? formatTime(entry.shifts.reduce((min, s) => s.startsAt < min ? s.startsAt : min, entry.shifts[0].startsAt))
    : null;

  const borderBar =
    entry.isHome === true
      ? "border-l-emerald-500"
      : entry.isHome === false
        ? "border-l-amber-500"
        : "border-l-transparent";

  return (
    <>
      {/* Parent event row */}
      <tr
        className={cn(
          "group/row border-l-[3px] transition-colors",
          borderBar,
          hasShifts ? "cursor-pointer" : "",
          isExpanded ? "bg-muted/20" : "hover:bg-muted/10",
        )}
        tabIndex={hasShifts ? 0 : undefined}
        role={hasShifts ? "link" : undefined}
        onClick={hasShifts ? onToggle : undefined}
        onKeyDown={
          hasShifts
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onToggle();
                }
              }
            : undefined
        }
      >
        <td className="pl-3 pr-1 py-3 border-b border-border/20 w-7">
          {hasShifts &&
            (isExpanded ? (
              <ChevronDownIcon className="size-4 text-muted-foreground" />
            ) : (
              <ChevronRightIcon className="size-4 text-muted-foreground" />
            ))}
        </td>
        <td className="px-4 py-3 border-b border-border/20">
          <div className="flex items-center gap-2 flex-wrap">
            {!entry.allDay && (
              <span
                className="text-[11px] text-muted-foreground/60 tabular-nums shrink-0"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {formatTime(entry.startsAt)}
              </span>
            )}
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
            {isStaff && onHide && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
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
          <span className="text-sm text-muted-foreground tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
            {callTime
              ? `Call ${callTime}–${formatTime(entry.endsAt)}`
              : entry.allDay
                ? "All day"
                : formatTime(entry.endsAt)}
          </span>
        </td>
      </tr>

      {/* Child shift rows */}
      {isExpanded &&
        entry.shifts.map((shift) => {
          const user = shiftAssignee(shift);
          const myAssignment = shift.assignments.find(
            (a) => a.user.id === currentUserId && ACTIVE_STATUSES.includes(a.status),
          );
          const isAway = entry.isHome !== true;
          const shiftTime = isAway
            ? "—"
            : `${formatTime(shift.startsAt)} – ${formatTime(shift.endsAt)}`;
          const isPickerOpen = pickerShiftId === shift.id;

          return (
            <tr
              key={shift.id}
              className="bg-muted/10 hover:bg-muted/25 cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-[-2px]"
              tabIndex={0}
              role="link"
              onClick={() => !isPickerOpen && onSelectGroup()}
              onKeyDown={(e) => {
                if (!isPickerOpen && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onSelectGroup();
                }
              }}
            >
              <td className="py-2.5 border-b border-border/15"></td>
              <td className="px-4 py-2.5 border-b border-border/15">
                <div className="flex items-center gap-2.5 pl-5">
                  {user ? (
                    <>
                      <UserAvatar name={user.name} avatarUrl={user.avatarUrl} />
                      <span className="text-sm">{user.name}</span>
                    </>
                  ) : isStaff ? (
                    <Popover
                      open={isPickerOpen}
                      onOpenChange={(open) => {
                        if (open) onOpenPicker(shift.id);
                        else onClosePicker();
                      }}
                    >
                      <PopoverTrigger asChild>
                        <button
                          className="flex items-center gap-2 hover:bg-muted/60 rounded px-1.5 py-1 -ml-1.5 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenPicker(shift.id);
                          }}
                        >
                          <div className="size-6 rounded-full border-[1.5px] border-dashed border-muted-foreground/30 flex items-center justify-center shrink-0">
                            <UserIcon className="size-3 text-muted-foreground/40" />
                          </div>
                          <span className="text-sm text-muted-foreground">
                            Unassigned
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
                          onSelect={(userId) =>
                            onInlineAssign(shift.id, userId)
                          }
                          disabled={assigning}
                        />
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <>
                      <div className="size-6 rounded-full border-[1.5px] border-dashed border-muted-foreground/30 flex items-center justify-center shrink-0">
                        <UserIcon className="size-3 text-muted-foreground/40" />
                      </div>
                      <span className="text-sm text-muted-foreground">
                        Unassigned
                      </span>
                    </>
                  )}
                  <Badge
                    variant={AREA_BADGE_VARIANT[shift.area] ?? "gray"}
                    size="sm"
                  >
                    {AREA_LABELS[shift.area] ?? shift.area}
                  </Badge>
                </div>
              </td>
              <td className="px-4 py-2.5 border-b border-border/15 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{shiftTime}</span>
                  {onPostTrade && myAssignment && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                      disabled={postingTradeId === myAssignment.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onPostTrade(myAssignment.id);
                      }}
                    >
                      {postingTradeId === myAssignment.id ? "Posting…" : "Post for trade"}
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
    </>
  );
}
