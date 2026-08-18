"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { handleAuthRedirect, parseErrorMessage, parseJsonSafely } from "@/lib/errors";
import type {
  BulkAssignmentPreviewEvent,
  BulkAssignmentPreviewResponse,
  BulkAssignmentScope,
} from "@/lib/bulk-schedule-assignment-types";
import { AREA_LABELS } from "@/types/areas";
import { SPORT_CODES } from "@/lib/sports";

type BulkAssignmentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: BulkAssignmentScope;
  onApplied: () => void;
};

function formatEventDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatScopeDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function sportLabel(sportCode: string | null) {
  return SPORT_CODES.find((sport) => sport.code === sportCode)?.label ?? sportCode ?? "All sports";
}

function eventSelectionLabel(event: BulkAssignmentPreviewEvent) {
  const count = event.proposals.length;
  return `${count} assignment${count === 1 ? "" : "s"}`;
}

export function BulkAssignmentDialog({
  open,
  onOpenChange,
  scope,
  onApplied,
}: BulkAssignmentDialogProps) {
  const [preview, setPreview] = useState<BulkAssignmentPreviewResponse | null>(null);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPreview(null);
    setSelectedEventIds(new Set());

    void (async () => {
      try {
        const response = await fetch("/api/schedule/bulk-assignment/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(scope),
        });
        if (handleAuthRedirect(response)) return;
        if (!response.ok) {
          setError(await parseErrorMessage(response, "The bulk assignment preview could not be loaded."));
          return;
        }
        const json = await parseJsonSafely<{ data?: BulkAssignmentPreviewResponse }>(response);
        if (!json?.data) {
          setError("The preview response was incomplete. Refresh and try again.");
          return;
        }
        if (cancelled) return;
        setPreview(json.data);
        setSelectedEventIds(new Set(
          json.data.events
            .filter((event) => event.status === "ready" && event.proposals.length > 0)
            .map((event) => event.eventId),
        ));
      } catch {
        if (!cancelled) setError("Could not reach the server. No assignments were changed.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, reloadToken, scope]);

  const selectedProposals = useMemo(
    () => preview?.events
      .filter((event) => selectedEventIds.has(event.eventId))
      .flatMap((event) => event.proposals) ?? [],
    [preview, selectedEventIds],
  );

  function toggleEvent(eventId: string, checked: boolean) {
    setSelectedEventIds((current) => {
      const next = new Set(current);
      if (checked) next.add(eventId);
      else next.delete(eventId);
      return next;
    });
  }

  async function applyAssignments() {
    if (!preview || selectedProposals.length === 0 || applying) return;
    setApplying(true);
    setError(null);
    try {
      const response = await fetch("/api/schedule/bulk-assignment/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: preview.scope,
          fingerprint: preview.fingerprint,
          proposals: selectedProposals.map(({ proposalId, shiftGroupId, shiftId, eventId, userId }) => ({
            proposalId,
            shiftGroupId,
            shiftId,
            eventId,
            userId,
          })),
        }),
      });
      if (handleAuthRedirect(response)) return;
      if (!response.ok) {
        const message = await parseErrorMessage(response, "The bulk assignment was not saved.");
        setError(message);
        toast.error(message);
        return;
      }
      const json = await parseJsonSafely<{ data?: { eventCount?: number; assignmentCount?: number; releaseAt?: string } }>(response);
      const eventCount = json?.data?.eventCount;
      const assignmentCount = json?.data?.assignmentCount;
      if (typeof eventCount !== "number" || typeof assignmentCount !== "number") {
        setError("Assignments were staged, but the confirmation was incomplete. Refresh the schedule to verify.");
        toast.warning("Assignments were staged. Refresh the schedule to verify.");
        onApplied();
        return;
      }
      toast.success(`Staged ${assignmentCount} assignment${assignmentCount === 1 ? "" : "s"} across ${eventCount} event${eventCount === 1 ? "" : "s"}`);
      onOpenChange(false);
      onApplied();
    } catch {
      const message = "Could not reach the server. No bulk assignment was saved.";
      setError(message);
      toast.error(message);
    } finally {
      setApplying(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-3xl">
        <DialogHeader className="pr-16">
          <div>
            <DialogTitle>Bulk assignment preview</DialogTitle>
            <DialogDescription className="mt-1">
              Review every proposed worker before changes are staged. Nothing changes until you apply.
            </DialogDescription>
          </div>
        </DialogHeader>

        <DialogBody className="min-h-0 px-6 py-4">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="purple">{sportLabel(scope.sportCode)}</Badge>
            <span>{formatScopeDate(scope.rangeStartsAt)} – {formatScopeDate(scope.rangeEndsAt)}</span>
            {scope.area ? <Badge variant="outline">{AREA_LABELS[scope.area] ?? scope.area}</Badge> : null}
          </div>

          {loading ? (
            <div className="flex min-h-56 items-center justify-center text-sm text-muted-foreground" aria-live="polite">
              <RefreshCw className="mr-2 size-4 animate-spin" /> Building the preview…
            </div>
          ) : error ? (
            <div className="flex min-h-56 flex-col items-center justify-center gap-3 text-center">
              <p className="max-w-md text-sm text-destructive" role="alert">{error}</p>
              <Button variant="outline" onClick={() => setReloadToken((value) => value + 1)}>
                <RefreshCw className="size-4" /> Refresh preview
              </Button>
            </div>
          ) : preview ? (
            <>
              <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-md border border-border/60 bg-muted/30 p-3">
                  <div className="text-[11px] text-muted-foreground">Events matched</div>
                  <div className="mt-1 text-lg font-semibold tabular-nums">{preview.summary.eventsMatched}</div>
                </div>
                <div className="rounded-md border border-border/60 bg-muted/30 p-3">
                  <div className="text-[11px] text-muted-foreground">Events ready</div>
                  <div className="mt-1 text-lg font-semibold tabular-nums">{preview.summary.eventsReady}</div>
                </div>
                <div className="rounded-md border border-border/60 bg-muted/30 p-3">
                  <div className="text-[11px] text-muted-foreground">Will assign</div>
                  <div className="mt-1 text-lg font-semibold tabular-nums">{selectedProposals.length}</div>
                </div>
                <div className="rounded-md border border-border/60 bg-muted/30 p-3">
                  <div className="text-[11px] text-muted-foreground">Needs review</div>
                  <div className="mt-1 text-lg font-semibold tabular-nums">{preview.summary.skipped}</div>
                </div>
              </div>

              <ScrollArea className="h-[min(52vh,34rem)] pr-3">
                <div className="flex flex-col gap-2">
                  {preview.events.map((event) => {
                    const selectable = event.status === "ready" && event.proposals.length > 0;
                    const selected = selectedEventIds.has(event.eventId);
                    return (
                      <div key={event.eventId} className="rounded-md border border-border/70 bg-card">
                        <div className="flex items-start gap-3 p-3">
                          <Checkbox
                            checked={selected}
                            disabled={!selectable || applying}
                            onCheckedChange={(checked) => toggleEvent(event.eventId, checked === true)}
                            aria-label={`Include ${event.summary}`}
                            className="mt-0.5 size-5"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="font-medium">{event.summary}</span>
                              <span className="text-xs text-muted-foreground">{formatEventDate(event.startsAt)}</span>
                              {selectable ? (
                                <Badge variant={selected ? "blue" : "outline"} size="sm">
                                  {eventSelectionLabel(event)}
                                </Badge>
                              ) : (
                                <Badge variant="orange" size="sm">Review needed</Badge>
                              )}
                            </div>
                            {event.proposals.length > 0 ? (
                              <div className="mt-3 flex flex-col gap-2">
                                {event.proposals.map((proposal) => (
                                  <div key={proposal.proposalId} className="flex flex-wrap items-start justify-between gap-2 rounded-md bg-muted/35 px-3 py-2">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 text-sm font-medium">
                                        <Users className="size-3.5 text-muted-foreground" />
                                        {proposal.userName}
                                      </div>
                                      <div className="mt-0.5 text-xs text-muted-foreground">
                                        {AREA_LABELS[proposal.area] ?? proposal.area} · {proposal.workerType === "ST" ? "Student" : "Staff"}
                                      </div>
                                      <div className="mt-1 text-xs text-muted-foreground">
                                        {proposal.warnings[0]?.label ?? proposal.reasons[0]?.label ?? "Best available fit"}
                                      </div>
                                    </div>
                                    <Badge variant={proposal.warnings.length > 0 ? "orange" : "blue"} size="sm">
                                      Score {proposal.score}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                            {event.skipped.length > 0 ? (
                              <div className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
                                {event.skipped.map((skipped, index) => (
                                  <div key={`${skipped.reasonCode}:${skipped.shiftId ?? index}`} className="flex gap-2">
                                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[var(--orange-text)]" />
                                    <span>{skipped.reason}</span>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {preview.events.length === 0 ? (
                    <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border p-6 text-center">
                      <CalendarDays className="size-5 text-muted-foreground" />
                      <p className="text-sm font-medium">No upcoming events match this scope.</p>
                      <p className="text-xs text-muted-foreground">Change the sport or month and build the preview again.</p>
                    </div>
                  ) : null}
                </div>
              </ScrollArea>
            </>
          ) : null}
        </DialogBody>

        <DialogFooter className="border-t pt-4">
          <div className="mr-auto flex items-center gap-2 text-xs text-muted-foreground">
            {preview && selectedProposals.length > 0 ? <Check className="size-4 text-[var(--blue-text)]" /> : null}
            {preview ? `${selectedProposals.length} assignment${selectedProposals.length === 1 ? "" : "s"} selected` : ""}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={applying}>Cancel</Button>
          <Button onClick={() => void applyAssignments()} disabled={!preview || selectedProposals.length === 0 || applying || loading}>
            {applying ? "Applying…" : `Apply ${selectedProposals.length || "assignments"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
