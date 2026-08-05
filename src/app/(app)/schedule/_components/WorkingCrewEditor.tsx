"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRightIcon, MoreHorizontalIcon, PlusIcon, RefreshCwIcon, SendIcon, UsersRoundIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { UserAvatar } from "@/components/UserAvatar";
import { UserAvatarPicker, type PickerUser } from "@/components/shift-detail/UserAvatarPicker";
import { handleAuthRedirect, parseErrorMessage, parseJsonSafely } from "@/lib/errors";
import { formatTimeShort } from "@/lib/format";
import type { WorkingScheduleCommand, WorkingSchedulePayload } from "@/lib/schedule-working-copy";
import type { CandidateRecommendation } from "@/lib/candidate-scoring-types";
import { cn } from "@/lib/utils";
import {
  AddSlotMenu,
  AssignSlotButton,
  CREW_CALL_TRIGGER_CLASS,
  CREW_ROW_GROUP,
  CREW_ROW_REVEAL,
  CrewAreaHeading,
  CrewTypeLabel,
} from "@/components/shift-detail/crew-row";
import type { CalendarEntry } from "./types";
import { AREA_LABELS } from "./types";

type RebaseSummary = {
  adoptedSlots: number;
  droppedSlots: number;
  refreshedAssignments: number;
  refreshedHistoryCounts: number;
  rebasedToPublishedVersion: number;
};

/** Say what the refresh actually pulled in, so it never looks like a no-op. */
function describeRebase(rebase: RebaseSummary | undefined): string {
  if (!rebase) return "Refreshed from the live schedule";
  const parts: string[] = [];
  if (rebase.adoptedSlots > 0) {
    parts.push(`${rebase.adoptedSlots} slot${rebase.adoptedSlots === 1 ? "" : "s"} added since you started`);
  }
  if (rebase.droppedSlots > 0) {
    parts.push(`${rebase.droppedSlots} deleted slot${rebase.droppedSlots === 1 ? "" : "s"} removed`);
  }
  if (rebase.refreshedAssignments > 0) {
    parts.push(`${rebase.refreshedAssignments} assignment${rebase.refreshedAssignments === 1 ? "" : "s"} updated`);
  }
  if (parts.length === 0) return "Already up to date with the live schedule";
  return `Refreshed: ${parts.join(", ")}`;
}

type EditorData = {
  shiftGroupId: string;
  publicationState: "draft" | "published" | "unpublished_changes";
  publishedAt: string | null;
  publishedVersion: number;
  workingVersion: number;
  hasWorkingCopy: boolean;
  allDay: boolean;
  defaultWindow: { startsAt: string; endsAt: string };
  changes: {
    addedSlots: number;
    removedSlots: number;
    convertedSlots: number;
    assignmentChanges: number;
    callWindowChanges: number;
    total: number;
  };
  affectedWorkerCount: number;
  assignedUsers: PickerUser[];
  schedule: WorkingSchedulePayload;
};

type Props = {
  entry: CalendarEntry;
  pickerUsers: PickerUser[];
  pickerLoading: boolean;
  pickerSearch: string;
  onOpenPicker: () => void;
  onClosePicker: () => void;
  onPickerSearchChange: (value: string) => void;
  onPublished: () => void;
  onManageEvent: () => void;
  compact?: boolean;
};

const AREA_ORDER = ["VIDEO", "PHOTO", "GRAPHICS", "COMMS", "LIVE_PRODUCTION"] as const;
// Call | Type | Person | row actions, matching the Event detail Crew table.
const SLOT_ROW_GRID_CLASS = "grid-cols-[4.5rem_4.5rem_minmax(0,1fr)_2.5rem]";

function stateBadge(data: EditorData) {
  if (data.publicationState === "unpublished_changes") {
    return <Badge variant="orange" size="sm">Unpublished changes</Badge>;
  }
  if (data.publicationState === "draft") {
    return <Badge variant="gray" size="sm">Draft</Badge>;
  }
  return null;
}

function changeSummary(data: EditorData) {
  const parts = [
    data.changes.addedSlots ? `${data.changes.addedSlots} added` : null,
    data.changes.removedSlots ? `${data.changes.removedSlots} removed` : null,
    data.changes.convertedSlots ? `${data.changes.convertedSlots} converted` : null,
    data.changes.assignmentChanges ? `${data.changes.assignmentChanges} assignment changes` : null,
    data.changes.callWindowChanges ? `${data.changes.callWindowChanges} call ${data.changes.callWindowChanges === 1 ? "time" : "times"}` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

function toLocalDateTimeValue(iso: string) {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function CallWindowEditor({
  slot,
  disabled,
  onSave,
}: {
  slot: WorkingSchedulePayload["slots"][number];
  disabled: boolean;
  onSave: (callStartsAt: string | null, callEndsAt: string | null) => void;
}) {
  const defaultStartsAt = slot.assignment?.callStartsAt ?? slot.callStartsAt ?? slot.startsAt;
  const defaultEndsAt = slot.assignment?.callEndsAt ?? slot.callEndsAt ?? slot.endsAt;
  const resetLabel = slot.assignment ? "Use slot time" : "Use shift time";
  const [open, setOpen] = useState(false);
  const [startsAt, setStartsAt] = useState(() => toLocalDateTimeValue(defaultStartsAt));
  const [endsAt, setEndsAt] = useState(() => toLocalDateTimeValue(defaultEndsAt));
  const inputId = slot.key.replace(/[^a-zA-Z0-9_-]/g, "-");

  useEffect(() => {
    setStartsAt(toLocalDateTimeValue(defaultStartsAt));
    setEndsAt(toLocalDateTimeValue(defaultEndsAt));
  }, [defaultEndsAt, defaultStartsAt]);

  function save() {
    const nextStartsAt = new Date(startsAt);
    const nextEndsAt = new Date(endsAt);
    if (!startsAt || !endsAt || Number.isNaN(nextStartsAt.getTime()) || Number.isNaN(nextEndsAt.getTime())) {
      toast.error("Enter both a call time and release time.");
      return;
    }
    if (nextEndsAt <= nextStartsAt) {
      toast.error("Release time must be after call time.");
      return;
    }
    onSave(nextStartsAt.toISOString(), nextEndsAt.toISOString());
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn("h-10 justify-start px-2 text-xs tabular-nums", CREW_CALL_TRIGGER_CLASS)}
          disabled={disabled}
          aria-label={`Edit call time for ${AREA_LABELS[slot.area] ?? slot.area} ${slot.workerType === "FT" ? "Staff" : "Student"} slot`}
        >
          {formatTimeShort(defaultStartsAt)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3 p-3" align="start">
        <div>
          <p className="text-sm font-medium">Call window</p>
          <p className="text-xs text-muted-foreground">Private until this schedule is published.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-xs" htmlFor={`${inputId}-call-start`}>
            <span className="text-muted-foreground">Call</span>
            <Input
              id={`${inputId}-call-start`}
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
            />
          </label>
          <label className="space-y-1 text-xs" htmlFor={`${inputId}-call-end`}>
            <span className="text-muted-foreground">Release</span>
            <Input
              id={`${inputId}-call-end`}
              type="datetime-local"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
            />
          </label>
        </div>
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => {
              onSave(null, null);
              setOpen(false);
            }}
          >
            {resetLabel}
          </Button>
          <Button type="button" size="sm" className="text-xs" onClick={save}>Save call time</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SetAllCallTimesEditor({
  data,
  disabled,
  onSave,
}: {
  data: Pick<EditorData, "defaultWindow" | "schedule">;
  disabled: boolean;
  onSave: (callStartsAt: string, callEndsAt: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [startsAt, setStartsAt] = useState(() => toLocalDateTimeValue(data.defaultWindow.startsAt));
  const [endsAt, setEndsAt] = useState(() => toLocalDateTimeValue(data.defaultWindow.endsAt));

  useEffect(() => {
    setStartsAt(toLocalDateTimeValue(data.defaultWindow.startsAt));
    setEndsAt(toLocalDateTimeValue(data.defaultWindow.endsAt));
  }, [data.defaultWindow.endsAt, data.defaultWindow.startsAt]);

  function save() {
    const nextStartsAt = new Date(startsAt);
    const nextEndsAt = new Date(endsAt);
    if (!startsAt || !endsAt || Number.isNaN(nextStartsAt.getTime()) || Number.isNaN(nextEndsAt.getTime())) {
      toast.error("Enter both a call time and release time.");
      return;
    }
    if (nextEndsAt <= nextStartsAt) {
      toast.error("Release time must be after call time.");
      return;
    }
    onSave(nextStartsAt.toISOString(), nextEndsAt.toISOString());
    setOpen(false);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-10 gap-1.5 px-2 text-xs"
        disabled={disabled || data.schedule.slots.length === 0}
        onClick={() => setOpen(true)}
      >
        <UsersRoundIcon className="size-3.5" />
        Set all call times
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set call time for everyone</DialogTitle>
            <DialogDescription>
              Every slot in this event will use this window. Personal call-time overrides will be cleared.
              The change stays private until you publish the schedule.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 px-6 py-2">
            <label className="space-y-1 text-xs" htmlFor="all-call-time-start">
              <span className="text-muted-foreground">Call time</span>
              <Input
                id="all-call-time-start"
                type="datetime-local"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
              />
            </label>
            <label className="space-y-1 text-xs" htmlFor="all-call-time-end">
              <span className="text-muted-foreground">Coverage end</span>
              <Input
                id="all-call-time-end"
                type="datetime-local"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
              />
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" onClick={save}>Apply to everyone</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function WorkingCrewEditor({
  entry,
  pickerUsers,
  pickerLoading,
  pickerSearch,
  onOpenPicker,
  onClosePicker,
  onPickerSearchChange,
  onPublished,
  onManageEvent,
  compact = false,
}: Props) {
  const shiftGroupId = entry.shiftGroupId;
  const [data, setData] = useState<EditorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actingKey, setActingKey] = useState<string | null>(null);
  const [publishReviewOpen, setPublishReviewOpen] = useState(false);
  const [candidateScoreState, setCandidateScoreState] = useState<{
    slotKey: string;
    scores: Record<string, CandidateRecommendation>;
  } | null>(null);
  const [scoresLoadingKey, setScoresLoadingKey] = useState<string | null>(null);
  const [scoresErrorKey, setScoresErrorKey] = useState<string | null>(null);
  const [replacementTarget, setReplacementTarget] = useState<{
    slotKey: string;
    workerType: "FT" | "ST";
    currentWorkerName: string;
  } | null>(null);
  const actingRef = useRef(false);

  const loadEditor = useCallback(async () => {
    if (!shiftGroupId) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/shift-groups/${shiftGroupId}/working-copy`);
      if (handleAuthRedirect(response)) return;
      if (!response.ok) {
        toast.error(await parseErrorMessage(response, "Failed to load working schedule"));
        return;
      }
      const json = await parseJsonSafely<{ data?: EditorData }>(response);
      if (json?.data) setData(json.data);
    } catch {
      toast.error("Network error - could not load working schedule");
    } finally {
      setLoading(false);
    }
  }, [shiftGroupId]);

  useEffect(() => {
    void loadEditor();
  }, [loadEditor]);

  const loadCandidateScores = useCallback(async (slotKey: string, workerType?: "FT" | "ST") => {
    if (!shiftGroupId) return;
    setScoresLoadingKey(slotKey);
    setScoresErrorKey(null);
    const query = new URLSearchParams({ slotKey });
    if (workerType) query.set("workerType", workerType);
    try {
      const response = await fetch(
        `/api/shift-groups/${shiftGroupId}/working-copy/candidate-scores?${query.toString()}`,
      );
      if (handleAuthRedirect(response)) return;
      if (!response.ok) {
        setScoresErrorKey(slotKey);
        return;
      }
      const json = await parseJsonSafely<{ data?: CandidateRecommendation[] }>(response);
      if (!json?.data) {
        setScoresErrorKey(slotKey);
        return;
      }
      setCandidateScoreState({
        slotKey,
        scores: Object.fromEntries(json.data.map((score) => [score.userId, score])),
      });
    } catch {
      setScoresErrorKey(slotKey);
    } finally {
      setScoresLoadingKey((current) => current === slotKey ? null : current);
    }
  }, [shiftGroupId]);

  const userById = useMemo(() => {
    const users = new Map<string, PickerUser>();
    for (const user of data?.assignedUsers ?? []) users.set(user.id, user);
    for (const user of pickerUsers) users.set(user.id, user);
    for (const shift of entry.shifts) {
      for (const assignment of shift.assignments) users.set(assignment.user.id, assignment.user);
    }
    return users;
  }, [data?.assignedUsers, entry.shifts, pickerUsers]);

  const mutate = useCallback(async (command: WorkingScheduleCommand, key: string) => {
    if (!shiftGroupId || !data || actingRef.current) return;
    actingRef.current = true;
    setActingKey(key);
    try {
      const response = await fetch(`/api/shift-groups/${shiftGroupId}/working-copy`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: data.workingVersion, command }),
      });
      if (handleAuthRedirect(response)) return;
      if (!response.ok) {
        toast.error(await parseErrorMessage(response, "Failed to update working schedule"));
        if (response.status === 409) void loadEditor();
        return;
      }
      const json = await parseJsonSafely<{ data?: EditorData }>(response);
      if (json?.data) setData(json.data);
      onPickerSearchChange("");
    } catch {
      toast.error("Network error - could not update working schedule");
    } finally {
      actingRef.current = false;
      setActingKey(null);
    }
  }, [data, loadEditor, onPickerSearchChange, shiftGroupId]);

  const discard = useCallback(async () => {
    if (!shiftGroupId || !data?.hasWorkingCopy || actingRef.current) return;
    actingRef.current = true;
    setActingKey("discard");
    try {
      const response = await fetch(
        `/api/shift-groups/${shiftGroupId}/working-copy?expectedVersion=${data.workingVersion}`,
        { method: "DELETE" },
      );
      if (handleAuthRedirect(response)) return;
      if (!response.ok) {
        toast.error(await parseErrorMessage(response, "Failed to discard changes"));
        if (response.status === 409) void loadEditor();
        return;
      }
      const json = await parseJsonSafely<{ data?: EditorData }>(response);
      if (json?.data) setData(json.data);
      toast.success("Unpublished changes discarded");
    } catch {
      toast.error("Network error - could not discard changes");
    } finally {
      actingRef.current = false;
      setActingKey(null);
    }
  }, [data, loadEditor, shiftGroupId]);

  /**
   * Re-seat the draft on the current live schedule. Every "refresh before
   * publishing" conflict used to leave Discard as the only exit, which meant
   * losing the whole draft to recover from a change someone else made.
   */
  const refreshFromLive = useCallback(async () => {
    if (!shiftGroupId || !data?.hasWorkingCopy || actingRef.current) return;
    actingRef.current = true;
    setActingKey("refresh");
    try {
      const response = await fetch(`/api/shift-groups/${shiftGroupId}/working-copy`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expectedVersion: data.workingVersion }),
      });
      if (handleAuthRedirect(response)) return;
      if (!response.ok) {
        toast.error(await parseErrorMessage(response, "Failed to refresh from the live schedule"));
        if (response.status === 409) void loadEditor();
        return;
      }
      const json = await parseJsonSafely<{ data?: EditorData & { rebase?: RebaseSummary } }>(response);
      if (json?.data) setData(json.data);
      toast.success(describeRebase(json?.data?.rebase));
    } catch {
      toast.error("Network error - could not refresh from the live schedule");
    } finally {
      actingRef.current = false;
      setActingKey(null);
    }
  }, [data, loadEditor, shiftGroupId]);

  const publish = useCallback(async () => {
    if (!shiftGroupId || !data || actingRef.current) return;
    actingRef.current = true;
    setActingKey("publish");
    try {
      const response = await fetch(`/api/shift-groups/${shiftGroupId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(data.hasWorkingCopy ? { expectedWorkingVersion: data.workingVersion } : {}),
        }),
      });
      if (handleAuthRedirect(response)) return;
      if (!response.ok) {
        toast.error(await parseErrorMessage(response, "Failed to publish schedule"));
        if (response.status === 409) void loadEditor();
        return;
      }
      setPublishReviewOpen(false);
      toast.success(data.publishedAt ? "Schedule changes published" : "Schedule published");
      onPublished();
      await loadEditor();
    } catch {
      toast.error("Network error - could not publish schedule");
    } finally {
      actingRef.current = false;
      setActingKey(null);
    }
  }, [data, loadEditor, onPublished, shiftGroupId]);

  if (!shiftGroupId) {
    return <p className="text-xs text-muted-foreground">Create staffing for this event before editing crew.</p>;
  }
  if (loading && !data) {
    return <div className="h-24 animate-pulse rounded-md bg-muted/30" />;
  }
  if (!data) {
    return (
      <Button variant="outline" size="sm" className="h-10" onClick={() => void loadEditor()}>
        Retry crew editor
      </Button>
    );
  }

  const areasWithSlots = AREA_ORDER
    .map((area) => ({ area, slots: data.schedule.slots.filter((slot) => slot.area === area) }))
    .filter(({ slots }) => slots.length > 0);
  const emptyAreas = AREA_ORDER.filter((area) => !areasWithSlots.some((entry) => entry.area === area));
  const replacementSlot = replacementTarget
    ? data.schedule.slots.find((slot) => slot.key === replacementTarget.slotKey) ?? null
    : null;
  const replacementUsers = replacementTarget
    ? pickerUsers.filter((candidate) => {
      const staffingType = candidate.staffingType ?? (candidate.role === "STUDENT" ? "ST" : "FT");
      return staffingType === replacementTarget.workerType;
    })
    : [];

  return (
    <div className="flex flex-col gap-2">
      {(data.publicationState !== "published" || data.changes.total > 0 || data.hasWorkingCopy || compact) && (
        <div className="flex min-h-10 flex-wrap items-center gap-2 pb-1">
          {stateBadge(data)}
          {data.changes.total > 0 && (
            <span className="text-xs text-muted-foreground">{changeSummary(data)}</span>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            {!data.allDay && data.schedule.slots.length > 0 && (
              <SetAllCallTimesEditor
                data={data}
                disabled={Boolean(actingKey)}
                onSave={(callStartsAt, callEndsAt) => void mutate(
                  { type: "setCallWindowForAll", callStartsAt, callEndsAt },
                  "all-call-window",
                )}
              />
            )}
            {data.hasWorkingCopy && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-10 gap-1.5 px-2 text-xs text-muted-foreground"
                disabled={Boolean(actingKey)}
                onClick={() => void refreshFromLive()}
                title="Pull any changes made to the live schedule into these unpublished changes"
              >
                <RefreshCwIcon className="size-3.5" />
                {actingKey === "refresh" ? "Refreshing..." : "Refresh from live"}
              </Button>
            )}
            {data.hasWorkingCopy && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-10 px-2 text-xs text-muted-foreground"
                disabled={Boolean(actingKey)}
                onClick={() => void discard()}
              >
                {actingKey === "discard" ? "Discarding..." : "Discard"}
              </Button>
            )}
            {(data.changes.total > 0 || !data.publishedAt) && (
              <Button
                type="button"
                size="sm"
                className="h-10 px-3 text-xs"
                disabled={Boolean(actingKey)}
                onClick={() => setPublishReviewOpen(true)}
              >
                <SendIcon data-icon="inline-start" />
                {data.publishedAt ? "Review & publish" : "Publish schedule"}
              </Button>
            )}
            {compact && (
              <Button type="button" variant="ghost" size="sm" className="h-10 px-2 text-xs text-muted-foreground" onClick={onManageEvent}>
                Event detail
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="divide-y divide-border/40 border-y border-border/40">
        {areasWithSlots.map(({ area, slots }) => {
          return (
            <section key={area} className={cn(compact ? "py-2" : "py-2.5")}>
              <CrewAreaHeading
                className="min-h-10 px-1"
                area={area}
                filled={slots.filter((slot) => slot.assignment).length}
                total={slots.length}
                action={
                  <AddSlotMenu
                    area={area}
                    disabled={Boolean(actingKey)}
                    onAdd={(workerType) => void mutate(
                      { type: "adjustSlots", area, workerType, delta: 1 },
                      `${area}-${workerType}-add`,
                    )}
                  />
                }
              />
              <div className="space-y-0.5">
                {slots.map((slot) => {
                  const user = slot.assignment ? userById.get(slot.assignment.userId) : null;
                  const roleLabel = slot.workerType === "FT" ? "Staff" : "Student";
                  const otherWorkerType = slot.workerType === "FT" ? "ST" : "FT";
                  const canConvert = !slot.assignment && slot.assignmentHistoryCount === 0;
                  const eligibleUsers = pickerUsers.filter((candidate) => {
                    const staffingType = candidate.staffingType ?? (candidate.role === "STUDENT" ? "ST" : "FT");
                    return staffingType === slot.workerType;
                  });
                  return slot.assignment ? (
                    <div key={slot.key} className={cn(`${CREW_ROW_GROUP} grid min-h-11 min-w-0 items-center gap-2 rounded-md px-1 hover:bg-muted/20`, SLOT_ROW_GRID_CLASS)}>
                      <CallWindowEditor
                        slot={slot}
                        disabled={Boolean(actingKey)}
                        onSave={(callStartsAt, callEndsAt) => void mutate(
                          { type: "setCallWindow", slotKey: slot.key, callStartsAt, callEndsAt },
                          `${slot.key}-call-window`,
                        )}
                      />
                      <CrewTypeLabel label={roleLabel} />
                      <div className="flex min-w-0 items-center gap-2">
                        <UserAvatar name={user?.name ?? "Assigned"} avatarUrl={user?.avatarUrl} size="sm" />
                        <span className="min-w-0 truncate text-sm">{user?.name ?? "Assigned worker"}</span>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className={cn("size-10 text-muted-foreground", CREW_ROW_REVEAL)}
                            aria-label={`Actions for ${user?.name ?? "assigned worker"}`}
                            disabled={Boolean(actingKey)}
                          >
                            <MoreHorizontalIcon className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuItem
                            onSelect={() => {
                              const target = {
                                slotKey: slot.key,
                                workerType: otherWorkerType as "FT" | "ST",
                                currentWorkerName: user?.name ?? "assigned worker",
                              };
                              setReplacementTarget(target);
                              onOpenPicker();
                              void loadCandidateScores(slot.key, target.workerType);
                            }}
                          >
                            <ArrowLeftRightIcon />
                            Replace and convert to {otherWorkerType === "FT" ? "Staff" : "Student"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => void mutate({ type: "unassign", slotKey: slot.key }, `${slot.key}-unassign`)}
                          >
                            <XIcon />
                            Unassign worker
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ) : (
                    <div key={slot.key} className={cn(`${CREW_ROW_GROUP} grid min-h-11 min-w-0 items-center gap-2 rounded-md px-1 hover:bg-muted/20`, SLOT_ROW_GRID_CLASS)}>
                      <CallWindowEditor
                        slot={slot}
                        disabled={Boolean(actingKey)}
                        onSave={(callStartsAt, callEndsAt) => void mutate(
                          { type: "setCallWindow", slotKey: slot.key, callStartsAt, callEndsAt },
                          `${slot.key}-call-window`,
                        )}
                      />
                      <CrewTypeLabel label={roleLabel} />
                      <Popover onOpenChange={(open) => {
                        if (open) {
                          onOpenPicker();
                          void loadCandidateScores(slot.key);
                        } else {
                          onClosePicker();
                        }
                      }}>
                        <PopoverTrigger asChild>
                          <AssignSlotButton
                            disabled={Boolean(actingKey)}
                            aria-label={`Assign ${roleLabel.toLowerCase()} slot`}
                          />
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-2" align="start">
                          <UserAvatarPicker
                            users={eligibleUsers}
                            loading={pickerLoading}
                            search={pickerSearch}
                            onSearchChange={onPickerSearchChange}
                            onSelect={(userId) => void mutate({ type: "assign", slotKey: slot.key, userId }, `${slot.key}-assign`)}
                            disabled={Boolean(actingKey)}
                            slotWorkerType={slot.workerType}
                            candidateScores={candidateScoreState?.slotKey === slot.key ? candidateScoreState.scores : undefined}
                            scoresLoading={scoresLoadingKey === slot.key}
                            scoresLoadError={scoresErrorKey === slot.key}
                          />
                        </PopoverContent>
                      </Popover>
                      {canConvert && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className={cn("col-start-4 size-10 text-muted-foreground", CREW_ROW_REVEAL)}
                              disabled={Boolean(actingKey)}
                              aria-label={`Actions for open ${roleLabel} slot`}
                            >
                              <MoreHorizontalIcon className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem
                              onSelect={() => void mutate(
                                { type: "convertSlot", slotKey: slot.key, workerType: otherWorkerType },
                                `${slot.key}-convert`,
                              )}
                            >
                              <ArrowLeftRightIcon />
                              Convert to {otherWorkerType === "FT" ? "Staff" : "Student"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => void mutate({ type: "removeSlot", slotKey: slot.key }, `${slot.key}-remove`)}
                            >
                              <XIcon />
                              Remove slot
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
        {emptyAreas.length > 0 && (
          <div className={cn("flex items-center", compact ? "py-1" : "py-1.5")}>
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="h-10 gap-1.5 px-2 text-xs text-muted-foreground">
                  <PlusIcon className="size-3.5" />
                  Add another area
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 space-y-1 p-2" align="start">
                {emptyAreas.map((area) => (
                  <div key={area} className="flex min-h-10 items-center gap-2 rounded-md px-2 hover:bg-muted/40">
                    <span className="min-w-0 flex-1 text-sm">{AREA_LABELS[area] ?? area}</span>
                    {(["FT", "ST"] as const).map((workerType) => {
                      const label = workerType === "FT" ? "Staff" : "Student";
                      return (
                        <Button
                          key={workerType}
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-10 px-2 text-xs"
                          disabled={Boolean(actingKey)}
                          onClick={() => void mutate(
                            { type: "adjustSlots", area, workerType, delta: 1 },
                            `${area}-${workerType}-add`,
                          )}
                        >
                          + {label}
                        </Button>
                      );
                    })}
                  </div>
                ))}
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      <Dialog
        open={replacementTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setReplacementTarget(null);
            onClosePicker();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Replace and convert to {replacementTarget?.workerType === "FT" ? "Staff" : "Student"}
            </DialogTitle>
            <DialogDescription>
              {replacementTarget
                ? `${replacementTarget.currentWorkerName} will be replaced when this private schedule is published.`
                : "Choose a replacement worker."}
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-2">
            {replacementSlot && replacementTarget ? (
              <UserAvatarPicker
                users={replacementUsers}
                loading={pickerLoading}
                search={pickerSearch}
                onSearchChange={onPickerSearchChange}
                onSelect={(userId) => {
                  void mutate(
                    {
                      type: "convertAndReplace",
                      slotKey: replacementTarget.slotKey,
                      workerType: replacementTarget.workerType,
                      userId,
                    },
                    `${replacementTarget.slotKey}-convert-replace`,
                  );
                  setReplacementTarget(null);
                  onClosePicker();
                }}
                disabled={Boolean(actingKey)}
                slotWorkerType={replacementTarget.workerType}
                candidateScores={candidateScoreState?.slotKey === replacementTarget.slotKey ? candidateScoreState.scores : undefined}
                scoresLoading={scoresLoadingKey === replacementTarget.slotKey}
                scoresLoadError={scoresErrorKey === replacementTarget.slotKey}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Refresh the schedule and try again.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={publishReviewOpen} onOpenChange={setPublishReviewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{data.publishedAt ? "Publish schedule changes?" : "Publish schedule?"}</DialogTitle>
            <DialogDescription>
              Draft edits stay private until this publish completes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 px-6 py-1 text-sm">
            {data.changes.total > 0 ? (
              <p>{changeSummary(data)}</p>
            ) : (
              <p>Publish the current crew schedule for the first time.</p>
            )}
            <p className="text-muted-foreground">
              {data.affectedWorkerCount === 0
                ? "No workers will be notified."
                : `${data.affectedWorkerCount} ${data.affectedWorkerCount === 1 ? "person" : "people"} will each receive one event summary.`}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishReviewOpen(false)} disabled={actingKey === "publish"}>Cancel</Button>
            <Button onClick={() => void publish()} disabled={actingKey === "publish"}>
              {actingKey === "publish" ? "Publishing..." : "Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
