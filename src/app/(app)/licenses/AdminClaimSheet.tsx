"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2, Archive, AlertCircle } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  const [editAccount, setEditAccount] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);

  useEffect(() => {
    if (!license) {
      setHistory([]);
      return;
    }
    setEditExpiry(license.expiresAt ? license.expiresAt.slice(0, 10) : "");
    setEditAccount(license.accountEmail ?? "");
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
      toast.success(claimId ? "Slot released" : "All slots released");
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

  async function handleSaveDetails() {
    if (!license) return;
    setSavingDetails(true);
    try {
      const res = await fetch(`/api/licenses/${license.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountEmail: editAccount.trim() || null,
          expiresAt: editExpiry ? new Date(editExpiry).toISOString() : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save");
      toast.success("License details updated");
      onAction();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSavingDetails(false);
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
  const expiryMs = license?.expiresAt ? new Date(license.expiresAt).getTime() : null;
  const isExpired = expiryMs != null && expiryMs < Date.now();
  const isExpiringSoon = expiryMs != null && !isExpired && expiryMs - Date.now() < 30 * 86_400_000;

  return (
    <Sheet open={!!license} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-md p-8">
        <SheetHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <SheetTitle className="font-mono text-sm break-all">{license?.code}</SheetTitle>
            {isExpired && <Badge variant="destructive" className="text-xs">Expired</Badge>}
            {isExpiringSoon && (
              <Badge variant="outline" className="text-xs border-yellow-400 text-yellow-700 dark:text-yellow-400">
                Expiring soon
              </Badge>
            )}
          </div>
          <SheetDescription className="space-y-0.5">
            {license?.label && <span className="block">{license.label}</span>}
            {license?.accountEmail && (
              <span className="block text-xs text-muted-foreground">{license.accountEmail}</span>
            )}
            {!license?.label && !license?.accountEmail && <span>License details</span>}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-10 space-y-10">
          {/* Active slots */}
          <section className="space-y-4">
            <h3 className="text-sm font-medium">Active slots ({activeClaims.length}/2)</h3>
            {activeClaims.length === 0 ? (
              <p className="text-xs text-muted-foreground">Both slots are open.</p>
            ) : (
              <div className="space-y-1.5">
                {activeClaims.map((claim) => {
                  const name = claim.user?.name ?? claim.occupantLabel ?? "Unknown";
                  return (
                    <div
                      key={claim.id}
                      className="flex items-center gap-2 rounded-md border bg-card p-2"
                    >
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
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                              disabled={!!releasing}
                            >
                              {releasing === claim.id ? "…" : "Release"}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Release {name}'s slot?</AlertDialogTitle>
                              <AlertDialogDescription>
                                The slot returns to the pool immediately. {name} will need to claim it again.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleReleaseClaim(claim.id)}>
                                Release
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {isAdmin && activeClaims.length > 1 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={!!releasing}
                  >
                    {releasing === "all" ? "Releasing all…" : "Release all slots"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Release all slots?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Both holders will be removed from this license. They will need to claim it again.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleReleaseClaim()}>
                      Release all
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </section>

          {/* Add unknown occupant */}
          {canAddOccupant && (
            <>
              <Separator />
              <section className="space-y-4">
                <h3 className="text-sm font-medium">Mark slot occupied</h3>
                <form onSubmit={handleAddOccupant} className="flex flex-col gap-2">
                  <Label htmlFor="occupant-name" className="text-xs">Occupant name</Label>
                  <div className="flex gap-2">
                    <Input
                      id="occupant-name"
                      value={occupantLabel}
                      onChange={(e) => setOccupantLabel(e.target.value)}
                      className="flex-1"
                    />
                    <Button type="submit" size="sm" disabled={addingOccupant || !occupantLabel.trim()}>
                      {addingOccupant ? "…" : "Add"}
                    </Button>
                  </div>
                </form>
              </section>
            </>
          )}

          {/* Details (admin) */}
          {isAdmin && (
            <>
              <Separator />
              <section className="space-y-5">
                <h3 className="text-sm font-medium">Details</h3>
                <div className="space-y-1.5">
                  <Label htmlFor="account" className="text-xs">Account email</Label>
                  <Input
                    id="account"
                    type="email"
                    value={editAccount}
                    onChange={(e) => setEditAccount(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="expiry" className="text-xs">Annual expiry</Label>
                  <Input
                    id="expiry"
                    type="date"
                    value={editExpiry}
                    onChange={(e) => setEditExpiry(e.target.value)}
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSaveDetails}
                  disabled={savingDetails}
                >
                  {savingDetails ? "Saving…" : "Save details"}
                </Button>
              </section>
            </>
          )}

          {/* Danger zone */}
          {isAdmin && (
            <>
              <Separator />
              <section className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Danger zone</h3>
                <div className="flex gap-2 flex-wrap">
                  {license?.status === "AVAILABLE" && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Archive className="size-3.5 mr-1.5" />
                          Retire
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Retire this license?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Retired licenses are hidden from students but kept for the audit log.
                            You can show them again from the page header.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleRetire}>Retire</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  {activeClaims.length === 0 && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-3.5 mr-1.5" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2">
                            <AlertCircle className="size-4 text-destructive" />
                            Delete this license?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This permanently deletes the license code and all of its claim history.
                            This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
                {activeClaims.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Release all slots before retiring or deleting.
                  </p>
                )}
              </section>
            </>
          )}

          <Separator />

          {/* History */}
          <section className="space-y-3 pb-8">
            <h3 className="text-sm font-medium">Claim history</h3>
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
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
