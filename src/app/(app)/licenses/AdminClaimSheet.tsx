"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatRelativeTime } from "@/lib/format";
import { getInitials } from "@/lib/avatar";
import type { LicenseCode } from "./types";

type ClaimRecord = {
  id: string;
  claimedAt: string;
  releasedAt: string | null;
  user: { id: string; name: string; avatarUrl: string | null };
};

type Props = {
  license: LicenseCode | null;
  onOpenChange: (open: boolean) => void;
  onAction: () => void;
};

export function AdminClaimSheet({ license, onOpenChange, onAction }: Props) {
  const [history, setHistory] = useState<ClaimRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [releasing, setReleasing] = useState(false);

  useEffect(() => {
    if (!license) return;
    setLoadingHistory(true);
    fetch(`/api/licenses/${license.id}/history`)
      .then((r) => r.json())
      .then((json) => setHistory(json.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [license?.id]);

  async function handleForceRelease() {
    if (!license) return;
    setReleasing(true);
    try {
      const res = await fetch(`/api/licenses/${license.id}/release`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to release license");
      toast.success("License released");
      onAction();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setReleasing(false);
    }
  }

  async function handleRetire() {
    if (!license) return;
    try {
      const res = await fetch(`/api/licenses/${license.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retire: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to retire license");
      toast.success("License retired");
      onAction();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function handleDelete() {
    if (!license) return;
    try {
      const res = await fetch(`/api/licenses/${license.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to delete license");
      toast.success("License deleted");
      onAction();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <Sheet open={!!license} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-mono text-sm">{license?.code}</SheetTitle>
          <SheetDescription>{license?.label ?? "No label"}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {license?.status === "CLAIMED" && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Currently held by</p>
              <div className="flex items-center gap-2">
                <Avatar className="size-7">
                  {license.claimedBy?.avatarUrl && (
                    <AvatarImage src={license.claimedBy.avatarUrl} alt={license.claimedBy.name} />
                  )}
                  <AvatarFallback className="text-xs">
                    {getInitials(license.claimedBy?.name ?? "")}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm">{license.claimedBy?.name}</span>
                {license.claimedAt && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    {formatRelativeTime(license.claimedAt, new Date())}
                  </span>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={handleForceRelease}
                disabled={releasing}
              >
                {releasing ? "Releasing…" : "Force release"}
              </Button>
            </div>
          )}

          <Separator />

          <div className="flex gap-2">
            {license?.status === "AVAILABLE" && (
              <Button variant="outline" size="sm" onClick={handleRetire}>
                Retire
              </Button>
            )}
            {license?.status !== "CLAIMED" && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={handleDelete}
              >
                Delete
              </Button>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-sm font-medium">Claim history</p>
            {loadingHistory ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : history.length === 0 ? (
              <p className="text-xs text-muted-foreground">No claims yet</p>
            ) : (
              <div className="space-y-2">
                {history.map((claim) => (
                  <div key={claim.id} className="flex items-center gap-2 text-sm">
                    <Avatar className="size-6">
                      {claim.user.avatarUrl && (
                        <AvatarImage src={claim.user.avatarUrl} alt={claim.user.name} />
                      )}
                      <AvatarFallback className="text-xs">
                        {getInitials(claim.user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate">{claim.user.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatRelativeTime(claim.claimedAt, new Date())}
                      {claim.releasedAt
                        ? ` → ${formatRelativeTime(claim.releasedAt, new Date())}`
                        : " (active)"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
