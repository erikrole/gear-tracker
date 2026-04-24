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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/format";
import { getInitials } from "@/lib/avatar";
import type { LicenseCode } from "./types";

type ClaimRecord = {
  id: string;
  userId: string | null;
  occupantLabel: string | null;
  claimedAt: string;
  releasedAt: string | null;
  user: { id: string; name: string; avatarUrl: string | null } | null;
};

type Props = {
  license: LicenseCode | null;
  isAdmin: boolean;
  onOpenChange: (open: boolean) => void;
  onAction: () => void;
};

export function AdminClaimSheet({ license, isAdmin, onOpenChange, onAction }: Props) {
  const [history, setHistory] = useState<ClaimRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [releasing, setReleasing] = useState<string | null>(null);
  const [occupantLabel, setOccupantLabel] = useState("");
  const [addingOccupant, setAddingOccupant] = useState(false);
  const [editExpiry, setEditExpiry] = useState("");
  const [savingExpiry, setSavingExpiry] = useState(false);

  useEffect(() => {
    if (!license) return;
    setEditExpiry(license.expiresAt ? license.expiresAt.slice(0, 10) : "");
    setLoadingHistory(true);
    fetch(`/api/licenses/${license.id}/history`)
      .then((r) => r.json())
      .then((json) => setHistory(json.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [license?.id]);

  async function handleReleaseClaim(claimId?: string) {
    if (!license) return;
    const key = claimId ?? "all";
    setReleasing(key);
    try {
      const res = await fetch(`/api/licenses/${license.id}/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(claimId ? { claimId } : {}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to release");
      toast.success("Slot released");
      onAction();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setReleasing(null);
    }
  }

  async function handleAddOccupant(e: React.FormEvent) {
    e.preventDefault();
    if (!license || !occupantLabel.trim()) return;
    setAddingOccupant(true);
    try {
      const res = await fetch(`/api/licenses/${license.id}/occupy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: occupantLabel.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to add occupant");
      toast.success("Unknown occupant recorded");
      setOccupantLabel("");
      onAction();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setAddingOccupant(false);
    }
  }

  async function handleSaveExpiry() {
    if (!license) return;
    setSavingExpiry(true);
    try {
      const expiresAt = editExpiry ? new Date(editExpiry).toISOString() : null;
      const res = await fetch(`/api/licenses/${license.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiresAt }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save");
      toast.success("Expiry updated");
      onAction();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSavingExpiry(false);
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

  const activeClaims = license?.claims ?? [];
  const canAddOccupant = isAdmin && activeClaims.length < 2;
  const isExpiringSoon =
    license?.expiresAt && new Date(license.expiresAt).getTime() - Date.now() < 30 * 86_400_000;
  const isExpired = license?.expiresAt && new Date(license.expiresAt) < new Date();

  return (
    <Sheet open={!!license} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-mono text-sm">{license?.code}</SheetTitle>
          <SheetDescription>
            {license?.label ?? "No label"}
            {license?.accountEmail && (
              <span className="block text-xs mt-0.5 text-muted-foreground">{license.accountEmail}</span>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* Active slots */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Active slots</p>
            {activeClaims.length === 0 ? (
              <p className="text-xs text-muted-foreground">No one is using this license.</p>
            ) : (
              activeClaims.map((claim) => {
                const name = claim.user?.name ?? claim.occupantLabel ?? "Unknown";
                return (
                  <div key={claim.id} className="flex items-center gap-2">
                    <Avatar className="size-7">
                      {claim.user?.avatarUrl && (
                        <AvatarImage src={claim.user.avatarUrl} alt={name} />
                      )}
                      <AvatarFallback className="text-xs">{getInitials(name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatRelativeTime(claim.claimedAt, new Date())}
                        {claim.userId === null && " · unknown user"}
                      </p>
                    </div>
                    {isAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive shrink-0"
                        onClick={() => handleReleaseClaim(claim.id)}
                        disabled={!!releasing}
                      >
                        {releasing === claim.id ? "…" : "Release"}
                      </Button>
                    )}
                  </div>
                );
              })
            )}
            {isAdmin && activeClaims.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => handleReleaseClaim()}
                disabled={!!releasing}
              >
                {releasing === "all" ? "Releasing…" : "Release all"}
              </Button>
            )}
          </div>

          {/* Add unknown occupant */}
          {canAddOccupant && (
            <>
              <Separator />
              <form onSubmit={handleAddOccupant} className="space-y-2">
                <Label htmlFor="occupant" className="text-sm font-medium">
                  Mark slot as occupied (unknown user)
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="occupant"
                    value={occupantLabel}
                    onChange={(e) => setOccupantLabel(e.target.value)}
                    placeholder="e.g. Hallie Utter"
                    className="flex-1"
                  />
                  <Button type="submit" size="sm" disabled={addingOccupant || !occupantLabel.trim()}>
                    {addingOccupant ? "…" : "Add"}
                  </Button>
                </div>
              </form>
            </>
          )}

          {/* Expiry */}
          {isAdmin && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">Annual expiry</p>
                  {isExpired && <Badge variant="destructive" className="text-xs">Expired</Badge>}
                  {!isExpired && isExpiringSoon && (
                    <Badge variant="outline" className="text-xs border-yellow-400 text-yellow-700">
                      Expiring soon
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={editExpiry}
                    onChange={(e) => setEditExpiry(e.target.value)}
                    className="flex-1"
                  />
                  <Button size="sm" variant="outline" onClick={handleSaveExpiry} disabled={savingExpiry}>
                    {savingExpiry ? "…" : "Save"}
                  </Button>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Admin actions */}
          {isAdmin && (
            <div className="flex gap-2">
              {license?.status !== "CLAIMED" && license?.status !== "PARTIAL" && (
                <Button variant="outline" size="sm" onClick={handleRetire}>
                  Retire
                </Button>
              )}
              {activeClaims.length === 0 && (
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
          )}

          <Separator />

          {/* History */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Claim history</p>
            {loadingHistory ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : history.length === 0 ? (
              <p className="text-xs text-muted-foreground">No claims yet</p>
            ) : (
              <div className="space-y-2">
                {history.map((claim) => {
                  const name = claim.user?.name ?? claim.occupantLabel ?? "Unknown";
                  return (
                    <div key={claim.id} className="flex items-center gap-2 text-sm">
                      <Avatar className="size-6">
                        {claim.user?.avatarUrl && (
                          <AvatarImage src={claim.user.avatarUrl} alt={name} />
                        )}
                        <AvatarFallback className="text-xs">{getInitials(name)}</AvatarFallback>
                      </Avatar>
                      <span className="flex-1 truncate">{name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatRelativeTime(claim.claimedAt, new Date())}
                        {claim.releasedAt
                          ? ` → ${formatRelativeTime(claim.releasedAt, new Date())}`
                          : " (active)"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
