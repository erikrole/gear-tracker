"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";

type CheckinSummaryDialogProps = {
  open: boolean;
  counts: { returned: number; damaged: number; lost: number } | null;
  onGoBack: () => void;
  onFinish: () => void;
  completing: boolean;
};

export function CheckinSummaryDialog({
  open,
  counts,
  onGoBack,
  onFinish,
  completing,
}: CheckinSummaryDialogProps) {
  if (!counts) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !completing) onGoBack(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Check-in Summary</DialogTitle>
          <DialogDescription>Review before completing.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <span className="text-sm text-muted-foreground">Items returned</span>
            <Badge variant="green">{counts.returned}</Badge>
          </div>

          {counts.damaged > 0 && (
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <span className="text-sm text-muted-foreground">Reported damaged</span>
              <Badge variant="orange">{counts.damaged}</Badge>
            </div>
          )}

          {counts.lost > 0 && (
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <span className="text-sm text-muted-foreground">Reported lost</span>
              <Badge variant="red">{counts.lost}</Badge>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onGoBack} disabled={completing}>
            Go Back
          </Button>
          <Button onClick={onFinish} disabled={completing}>
            {completing ? (
              <>
                <Spinner data-icon="inline-start" />
                Completing...
              </>
            ) : (
              "Finish Check-in"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
