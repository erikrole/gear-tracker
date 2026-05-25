"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { handleAuthRedirect, parseErrorMessage, parseJsonSafely } from "@/lib/errors";
import type { LicenseCode } from "./types";

type Props = {
  license: LicenseCode | null;
  onOpenChange: (open: boolean) => void;
  onClaimed: () => void;
};

type ClaimResponse = {
  data?: {
    code?: string;
  };
};

export function ConfirmClaimDialog({ license, onOpenChange, onClaimed }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleClaim() {
    if (!license) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/licenses/${license.id}/claim`, { method: "POST" });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) throw new Error(await parseErrorMessage(res, "Failed to claim license"));

      const json = await parseJsonSafely<ClaimResponse>(res);
      const code = json?.data?.code;
      if (!code) throw new Error("License claimed, but no code was returned");
      await navigator.clipboard.writeText(code);
      toast.success("License claimed and copied to clipboard", {
        description: code,
        duration: 6000,
      });
      onClaimed();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={!!license} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Claim Photo Mechanic license?</DialogTitle>
          <DialogDescription>
            You can only hold one license at a time. The code will be copied to your clipboard
            automatically.
            {license?.label && (
              <span className="block mt-1 text-xs text-muted-foreground">{license.label}</span>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleClaim} loading={loading}>
            {loading ? "Claiming…" : "Claim & copy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
