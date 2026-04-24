"use client";

import { useState } from "react";
import { toast } from "sonner";
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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  licenseId: string;
  onReleased: () => void;
};

export function ReleaseDialog({ open, onOpenChange, licenseId, onReleased }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleRelease() {
    setLoading(true);
    try {
      const res = await fetch(`/api/licenses/${licenseId}/release`, { method: "POST" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Failed to release license");
      }
      toast.success("License returned");
      onReleased();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Return this license?</AlertDialogTitle>
          <AlertDialogDescription>
            The license code will go back into the pool for others to use. You can always claim
            another one later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleRelease} disabled={loading}>
            {loading ? "Returning…" : "Return license"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
