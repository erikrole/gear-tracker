"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2, Archive, AlertCircle, RefreshCw } from "lucide-react";
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
import { UserAvatar } from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/format";
import { handleAuthRedirect, isAbortError, parseErrorMessage, parseJsonSafely } from "@/lib/errors";
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

type LicenseHistoryResponse = {
  data?: ClaimRecord[];
};

async function throwLicenseError(res: Response, fallback: string) {
  if (handleAuthRedirect(res)) return true;
  if (!res.ok) throw new Error(await parseErrorMessage(res, fallback));
  return false;
}

export function AdminClaimSheet({ license, isAdmin, onOpenChange, onAction }: Props) {
  const [history, setHistory] = useState<ClaimRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [releasing, setReleasing] = useState<string | null>(null);
  const [occupantLabel, setOccupantLabel] = useState("");
  const [addingOccupant, setAddingOccupant] = useState(false);
  const [editExpiry, setEditExpiry] = useState("");
  const [editAccount, setEditAccount] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);
  const [retiring, setRetiring] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadHistory = useCallback(async (signal?: AbortSignal) => {
    if (!license) return;
    setLoadingHistory(true);
    setHistoryError(false);
    try {
      const res = await fetch(`/api/licenses/${license.id}/history`, { signal });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) throw new Error(await parseErrorMessage(res, "Failed to load license history"));
      const json = await parseJsonSafely<LicenseHistoryResponse>(res);
      setHistory(json?.data ?? []);
    } catch (err) {
      if (isAbortError(err)) return;
      setHistory([]);
      setHistoryError(true);
    } finally {
      if (!signal?.aborted) setLoadingHistory(false);
    }
  }, [license?.id]);

  useEffect(() => {
    if (!license) {
      setHistory([]);
      setHistoryError(false);
      return;
    }
    setEditExpiry(license.expiresAt ? license.expiresAt.slice(0, 10) : "");
    setEditAccount(license.accountEmail ?? "");
    setHistory([]);
    const controller = new AbortController();
    void loadHistory(controller.signal);
    return () => controller.abort();
  }, [license?.id, license?.expiresAt, license?.accountEmail, loadHistory]);

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
      if (await throwLicenseError(res, "Failed to release")) return;
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
      if (await throwLicenseError(res, "Failed to add occupant")) return;
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
      if (await throwLicenseError(res, "Failed to save")) return;
      toast.success("License details updated");
      onAction();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSavingDetails(false);
    }
  }

  async function handleRetire() {
    if (!license || retiring) return;
    setRetiring(true);
    try {
      const res = await fetch(`/api/licenses/${license.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retire: true }),
      });
      if (await throwLicenseError(res, "Failed to retire license")) return;
      toast.success("License retired");
      onAction();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setRetiring(false);
    }
  }

  async function handleDelete() {
    if (!license || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/licenses/${license.id}`, { method: "DELETE" });
      if (await throwLicenseError(res, "Failed to delete license")) return;
      toast.success("License deleted");
      onAction();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setDeleting(false);
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
                      <UserAvatar name={name} avatarUrl={claim.user?.avatarUrl} size="default" />
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
                      name="occupantName"
                      autoComplete="off"
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
                    name="accountEmail"
                    type="email"
                    autoComplete="email"
                    value={editAccount}
                    onChange={(e) => setEditAccount(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="expiry" className="text-xs">Annual expiry</Label>
                  <Input
                    id="expiry"
                    name="expiresAt"
                    type="date"
                    autoComplete="off"
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
                        <Button variant="outline" size="sm" disabled={retiring}>
                          <Archive className="size-3.5 mr-1.5" />
                          {retiring ? "Retiring..." : "Retire"}
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
                          <AlertDialogAction onClick={handleRetire} disabled={retiring}>
                            {retiring ? "Retiring..." : "Retire"}
                          </AlertDialogAction>
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
                          disabled={deleting}
                        >
                          <Trash2 className="size-3.5 mr-1.5" />
                          {deleting ? "Deleting..." : "Delete"}
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
                            disabled={deleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {deleting ? "Deleting..." : "Delete"}
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
            ) : historyError ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>Claim history could not load. Retry before auditing this license.</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    onClick={() => void loadHistory()}
                  >
                    <RefreshCw className="size-3" />
                    Retry
                  </Button>
                </div>
              </div>
            ) : history.length === 0 ? (
              <p className="text-xs text-muted-foreground">No claims yet</p>
            ) : (
              <div className="space-y-2">
                {history.map((claim) => {
                  const name = claim.user?.name ?? claim.occupantLabel ?? "Unknown";
                  return (
                    <div key={claim.id} className="flex items-center gap-2 text-sm">
                      <UserAvatar name={name} avatarUrl={claim.user?.avatarUrl} size="sm" />
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
