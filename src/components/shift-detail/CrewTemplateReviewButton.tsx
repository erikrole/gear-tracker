"use client";

import { useRef, useState } from "react";
import { ClipboardCopyIcon, Layers3Icon } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { handleAuthRedirect, parseErrorMessage, parseJsonSafely } from "@/lib/errors";
import type {
  CopyForwardApplyResult,
  ScheduleTemplateReview,
} from "@/lib/schedule-template-review-types";
import { shiftWorkerSlotLabel } from "@/lib/shift-display";

type CrewTemplateReviewButtonProps = {
  shiftGroupId: string;
  disabled?: boolean;
  onUpdated?: () => void;
};

function areaLabel(area: string) {
  return area.charAt(0) + area.slice(1).toLowerCase();
}

export function CrewTemplateReviewButton({
  shiftGroupId,
  disabled,
  onUpdated,
}: CrewTemplateReviewButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [review, setReview] = useState<ScheduleTemplateReview | null>(null);
  const busyRef = useRef(false);

  async function loadReview() {
    if (busyRef.current) return;
    busyRef.current = true;
    setLoading(true);
    try {
      const res = await fetch(`/api/shift-groups/${shiftGroupId}/template-review`);
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        const json = await parseJsonSafely<{ data?: ScheduleTemplateReview }>(res);
        if (!json?.data) {
          toast.error("Crew template review could not be read. Refresh and try again.");
          return;
        }
        setReview(json.data);
        setOpen(true);
      } else {
        toast.error(await parseErrorMessage(res, "Crew template review failed"));
      }
    } catch {
      toast.error("Could not reach the server. Crew template review was not loaded.");
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  }

  async function applyCopyForward() {
    if (busyRef.current || !review) return;
    busyRef.current = true;
    setApplying(true);
    try {
      const res = await fetch(`/api/shift-groups/${shiftGroupId}/template-review`, { method: "POST" });
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        const json = await parseJsonSafely<{ data?: CopyForwardApplyResult }>(res);
        const assigned = json?.data?.assigned ?? 0;
        const skipped = json?.data?.skipped ?? 0;
        if (assigned > 0) {
          toast.success(`Copied ${assigned} crew assignment${assigned === 1 ? "" : "s"} forward`);
        } else {
          toast.info("No crew assignments were copied forward");
        }
        if (skipped > 0) {
          toast.warning(`${skipped} copied crew suggestion${skipped === 1 ? " was" : "s were"} skipped`);
        }
        setOpen(false);
        setReview(null);
        onUpdated?.();
      } else {
        toast.error(await parseErrorMessage(res, "Copy-forward failed"));
      }
    } catch {
      toast.error("Could not reach the server. Crew was not copied forward.");
    } finally {
      busyRef.current = false;
      setApplying(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={loadReview}
        disabled={disabled || loading}
      >
        <Layers3Icon data-icon="inline-start" />
        {loading ? "Reviewing..." : "Review template"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Crew template review</DialogTitle>
            <DialogDescription>
              Compare this event to the sport template and preview crew copied from the last matching event.
            </DialogDescription>
          </DialogHeader>

          {review && (
            <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
              <section className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">Template drift</h3>
                  {review.template.manuallyEdited && <Badge variant="orange">Manual slots preserved</Badge>}
                </div>
                <Alert>
                  <AlertDescription>{review.template.message}</AlertDescription>
                </Alert>
                {review.template.expected.length > 0 && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {review.template.expected.map((row) => (
                      <div key={`${row.area}-${row.workerType}`} className="rounded-lg border border-border/60 p-3 text-sm">
                        <div className="font-medium">{areaLabel(row.area)} · {shiftWorkerSlotLabel(row.workerType)}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Current {row.current} of {row.expected} expected
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {(review.template.missing.length > 0 || review.template.extra.length > 0) && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {review.template.missing.map((slot) => (
                      <div key={`missing-${slot.area}-${slot.workerType}`} className="rounded-lg border border-dashed border-border/70 p-3 text-sm">
                        <Badge variant="orange" size="sm">Missing {slot.count}</Badge>
                        <div className="mt-1 font-medium">{areaLabel(slot.area)} · {shiftWorkerSlotLabel(slot.workerType)}</div>
                        <p className="mt-1 text-xs text-muted-foreground">Can be added without removing manual slots.</p>
                      </div>
                    ))}
                    {review.template.extra.map((slot) => (
                      <div key={`extra-${slot.area}-${slot.workerType}`} className="rounded-lg border border-border/60 p-3 text-sm">
                        <Badge variant="gray" size="sm">Extra {slot.count}</Badge>
                        <div className="mt-1 font-medium">{areaLabel(slot.area)} · {shiftWorkerSlotLabel(slot.workerType)}</div>
                        <p className="mt-1 text-xs text-muted-foreground">Left unchanged unless staff removes it.</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <Separator />

              <section className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">Copy-forward preview</h3>
                  <Badge variant={review.copyForward.summary.proposed > 0 ? "green" : "gray"}>
                    {review.copyForward.summary.proposed} proposed
                  </Badge>
                </div>
                {review.copyForward.sourceEvent ? (
                  <p className="text-sm text-muted-foreground">
                    Source: {review.copyForward.sourceEvent.summary}
                  </p>
                ) : (
                  <Alert>
                    <AlertDescription>No earlier staffed event matched this sport.</AlertDescription>
                  </Alert>
                )}
                <div className="flex flex-col gap-2">
                  {review.copyForward.proposals.map((proposal) => (
                    <div key={proposal.shiftId} className="rounded-lg border border-border/60 p-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium">{proposal.userName}</div>
                          <div className="text-xs text-muted-foreground">
                            {areaLabel(proposal.area)} · {shiftWorkerSlotLabel(proposal.workerType)}
                          </div>
                        </div>
                        <Badge variant={proposal.warnings.length > 0 ? "orange" : "green"} className="shrink-0">
                          {proposal.score ?? "Copy"}
                        </Badge>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {[proposal.warnings[0]?.label, proposal.reasons[0]?.label].filter(Boolean).join(" · ") || "Matched from the previous crew."}
                      </div>
                    </div>
                  ))}
                  {review.copyForward.skipped.map((slot) => (
                    <div key={`${slot.shiftId}-${slot.reason}`} className="rounded-lg border border-dashed border-border/70 p-3 text-sm">
                      <div className="font-medium">
                        {areaLabel(slot.area)} · {shiftWorkerSlotLabel(slot.workerType)}
                      </div>
                      <div className="text-xs text-muted-foreground">{slot.reason}</div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={applying}>
              Cancel
            </Button>
            <Button
              onClick={applyCopyForward}
              disabled={applying || !review || review.copyForward.proposals.length === 0}
            >
              <ClipboardCopyIcon data-icon="inline-start" />
              {applying ? "Copying..." : "Copy crew forward"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
