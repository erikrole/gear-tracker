"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ReportDamageDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetTag: string;
  onConfirm: (description: string) => void;
  submitting?: boolean;
};

export function ReportDamageDialog({
  open,
  onOpenChange,
  assetTag,
  onConfirm,
  submitting,
}: ReportDamageDialogProps) {
  const [description, setDescription] = useState("");

  function handleConfirm() {
    onConfirm(description);
    setDescription("");
  }

  function handleOpenChange(v: boolean) {
    if (!v) setDescription("");
    onOpenChange(v);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report Damage</DialogTitle>
          <DialogDescription>
            Report <span className="font-semibold text-[var(--foreground)]">{assetTag}</span> as
            damaged. A supervisor will be notified.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder="Describe what happened..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={1000}
        />
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={submitting || !description.trim()}
          >
            {submitting ? "Reporting..." : "Report Damage"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
