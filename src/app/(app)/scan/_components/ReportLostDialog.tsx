"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ReportLostDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetTag: string;
  onConfirm: () => void;
  submitting?: boolean;
};

export function ReportLostDialog({
  open,
  onOpenChange,
  assetTag,
  onConfirm,
  submitting,
}: ReportLostDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Report Lost Item</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to report{" "}
            <span className="font-semibold text-[var(--foreground)]">{assetTag}</span> as lost? A
            supervisor will be notified.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={submitting}
            className="bg-red-600 hover:bg-red-700"
          >
            {submitting ? "Reporting..." : "Report Lost"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
