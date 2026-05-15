"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FadeUp } from "@/components/ui/motion";
import { useConfirm } from "@/components/ConfirmDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  Copy,
  Monitor,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  ShoppingBag,
  Trash2,
  WifiOff,
  X,
} from "lucide-react";
import { handleAuthRedirect, parseErrorMessage, classifyError, isAbortError } from "@/lib/errors";
import { useFetch } from "@/hooks/use-fetch";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type PendingPickup = {
  id: string;
  title: string;
  requesterName: string;
  startsAt: string;
  endsAt: string;
};

type KioskDevice = {
  id: string;
  name: string;
  locationId: string;
  location: { id: string; name: string };
  active: boolean;
  activated: boolean;
  activatedAt: string | null;
  lastSeenAt: string | null;
  sessionExpiresAt: string | null;
  createdAt: string;
  pendingPickupCount: number;
  openCheckoutCount: number;
  pendingPickups: PendingPickup[];
};

type LocationOption = { id: string; name: string };
type ErrorState = { type: "network" | "server" | "auth"; message: string };

/** Online = heartbeat in last 5 min, Recent = last 24h, Offline = stale */
function connectionStatus(device: KioskDevice): "online" | "recent" | "offline" | "inactive" {
  if (!device.activated || !device.active) return "inactive";
  if (!device.lastSeenAt) return "offline";
  const mins = (Date.now() - new Date(device.lastSeenAt).getTime()) / 60000;
  if (mins <= 5) return "online";
  if (mins <= 60 * 24) return "recent";
  return "offline";
}

function sessionExpiringSoon(device: KioskDevice): boolean {
  if (!device.sessionExpiresAt || !device.activated) return false;
  const daysLeft = (new Date(device.sessionExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return daysLeft <= 3;
}

function StatusDot({ status }: { status: ReturnType<typeof connectionStatus> }) {
  if (status === "online")
    return <span className="relative flex size-2"><span className="absolute inline-flex size-full rounded-full bg-emerald-500 opacity-75 animate-ping" /><span className="relative inline-flex size-2 rounded-full bg-emerald-500" /></span>;
  if (status === "recent")
    return <span className="size-2 rounded-full bg-amber-400" />;
  if (status === "offline")
    return <span className="size-2 rounded-full bg-destructive" />;
  return <span className="size-2 rounded-full bg-muted-foreground/40" />;
}

export default function KioskDevicesPage() {
  const confirm = useConfirm();

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [cancellingPickupId, setCancellingPickupId] = useState<string | null>(null);

  // Add form
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addLocationId, setAddLocationId] = useState("");
  const [adding, setAdding] = useState(false);

  // Activation code display
  const [codeDialog, setCodeDialog] = useState<{ name: string; code: string } | null>(null);

  // Pending pickup clear dialog
  const [pickupDialog, setPickupDialog] = useState<KioskDevice | null>(null);

  const {
    data: devices,
    loading,
    error: fetchError,
    reload: load,
  } = useFetch<KioskDevice[]>({
    url: "/api/kiosk-devices",
    returnTo: "/settings/kiosk-devices",
  });

  const { data: formOptions } = useFetch<{ locations: LocationOption[] }>({
    url: "/api/form-options",
    returnTo: "/settings/kiosk-devices",
    transform: (json) => (json as Record<string, unknown>).data as { locations: LocationOption[] },
    refetchOnFocus: false,
  });
  const locations = formOptions?.locations ?? [];

  const error: ErrorState | null = fetchError
    ? { type: fetchError, message: fetchError === "network" ? "Could not connect to server" : "Failed to load kiosk devices" }
    : null;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = addName.trim();
    if (!trimmedName || !addLocationId) return;

    setAdding(true);
    try {
      const res = await fetch("/api/kiosk-devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, locationId: addLocationId }),
      });
      if (handleAuthRedirect(res, "/settings/kiosk-devices")) return;
      if (res.ok) {
        const json = await res.json();
        setCodeDialog({ name: trimmedName, code: json.activationCode });
        setShowAdd(false);
        setAddName("");
        setAddLocationId("");
        load();
      } else {
        const msg = await parseErrorMessage(res, "Failed to create kiosk device");
        toast.error(msg);
      }
    } catch (err) {
      if (isAbortError(err)) return;
      const kind = classifyError(err);
      toast.error(kind === "network" ? "You're offline. Check your connection." : "Failed to create kiosk device");
    } finally {
      setAdding(false);
    }
  }

  async function handleToggle(device: KioskDevice) {
    const action = device.active ? "deactivate" : "activate";
    if (device.active) {
      const ok = await confirm({
        title: "Deactivate kiosk?",
        message: `This will sign out "${device.name}" and require re-activation with a new code.`,
        confirmLabel: "Deactivate",
        variant: "danger",
      });
      if (!ok) return;
    }

    setTogglingId(device.id);
    try {
      const res = await fetch(`/api/kiosk-devices/${device.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !device.active }),
      });
      if (handleAuthRedirect(res, "/settings/kiosk-devices")) return;
      if (res.ok) {
        toast.success(`Kiosk ${action}d`);
        load();
      } else {
        toast.error(`Failed to ${action} kiosk`);
      }
    } catch (err) {
      if (isAbortError(err)) return;
      const kind = classifyError(err);
      toast.error(kind === "network" ? "You're offline. Check your connection." : `Failed to ${action} kiosk`);
    } finally {
      setTogglingId(null);
    }
  }

  async function handleRegenerate(device: KioskDevice) {
    if (device.activated) {
      toast.error("Deactivate the kiosk before regenerating its code.");
      return;
    }
    setRegeneratingId(device.id);
    try {
      const res = await fetch(`/api/kiosk-devices/${device.id}/regenerate-code`, {
        method: "POST",
      });
      if (handleAuthRedirect(res, "/settings/kiosk-devices")) return;
      if (res.ok) {
        const json = await res.json();
        setCodeDialog({ name: device.name, code: json.activationCode });
        toast.success("New activation code generated");
      } else {
        const msg = await parseErrorMessage(res, "Failed to regenerate code");
        toast.error(msg);
      }
    } catch (err) {
      if (isAbortError(err)) return;
      const kind = classifyError(err);
      toast.error(kind === "network" ? "You're offline. Check your connection." : "Failed to regenerate code");
    } finally {
      setRegeneratingId(null);
    }
  }

  async function handleDelete(device: KioskDevice) {
    const ok = await confirm({
      title: "Delete kiosk device?",
      message: `Permanently delete "${device.name}"? This cannot be undone.`,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;

    setDeletingId(device.id);
    try {
      const res = await fetch(`/api/kiosk-devices/${device.id}`, {
        method: "DELETE",
      });
      if (handleAuthRedirect(res, "/settings/kiosk-devices")) return;
      if (res.ok) {
        toast.success("Kiosk device deleted");
        load();
      } else {
        toast.error("Failed to delete kiosk device");
      }
    } catch (err) {
      if (isAbortError(err)) return;
      const kind = classifyError(err);
      toast.error(kind === "network" ? "You're offline. Check your connection." : "Failed to delete kiosk device");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCancelPickup(booking: PendingPickup) {
    const ok = await confirm({
      title: "Cancel pending pickup?",
      message: `Cancel "${booking.title}" for ${booking.requesterName}? This releases all reserved items.`,
      confirmLabel: "Cancel pickup",
      variant: "danger",
    });
    if (!ok) return;

    setCancellingPickupId(booking.id);
    try {
      const res = await fetch(`/api/bookings/${booking.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (handleAuthRedirect(res, "/settings/kiosk-devices")) return;
      if (res.ok) {
        toast.success("Pickup cancelled");
        setPickupDialog(null);
        load();
      } else {
        const msg = await parseErrorMessage(res, "Failed to cancel pickup");
        toast.error(msg);
      }
    } catch (err) {
      if (isAbortError(err)) return;
      const kind = classifyError(err);
      toast.error(kind === "network" ? "You're offline. Check your connection." : "Failed to cancel pickup");
    } finally {
      setCancellingPickupId(null);
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    toast.success("Code copied to clipboard");
  }

  function formatRelative(dateStr: string | null): string {
    if (!dateStr) return "Never";
    return formatRelativeTime(dateStr, new Date());
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  return (
    <FadeUp>
    <div className="grid grid-cols-[260px_1fr] gap-8 items-start max-lg:grid-cols-1 max-lg:gap-4">
      <div className="sticky top-20 max-lg:static">
        <h2 className="text-2xl font-bold mb-2">Kiosk Devices</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Manage iPad kiosk stations for self-serve gear checkout.
        </p>
      </div>

      <div className="min-w-0 space-y-4">
        <div className="flex justify-end">
          {!showAdd && (
            <Button onClick={() => setShowAdd(true)} size="sm">
              <Plus className="size-4 mr-1.5" />
              Add Kiosk
            </Button>
          )}
        </div>

      {/* Add form */}
      {showAdd && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">New Kiosk Device</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="flex items-end gap-3">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="kiosk-name">Name</Label>
                <Input
                  id="kiosk-name"
                  placeholder="e.g. Video Office iPad"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  disabled={adding}
                />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="kiosk-location">Location</Label>
                <Select
                  value={addLocationId}
                  onValueChange={setAddLocationId}
                  disabled={adding}
                >
                  <SelectTrigger id="kiosk-location">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={adding || !addName.trim() || !addLocationId}>
                {adding && <Spinner data-icon="inline-start" />}
                Create
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowAdd(false);
                  setAddName("");
                  setAddLocationId("");
                }}
                disabled={adding}
              >
                Cancel
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Error state */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-3 py-4">
            {error.type === "network" ? (
              <WifiOff className="size-5 text-destructive" />
            ) : (
              <AlertTriangle className="size-5 text-destructive" />
            )}
            <span className="text-sm text-destructive">{error.message}</span>
            <Button variant="outline" size="sm" className="ml-auto" onClick={load}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {loading && !error && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="size-10 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-8 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && (devices ?? []).length === 0 && (
        <Card>
          <CardContent className="py-10 text-center">
            <Monitor className="size-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No kiosk devices yet. Add one to enable self-serve checkout on an iPad.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Device list */}
      {!loading && !error && (devices ?? []).length > 0 && (
        <div className="space-y-3">
          {(devices ?? []).map((device) => {
            const status = connectionStatus(device);
            const expiringSession = sessionExpiringSoon(device);
            return (
              <Card key={device.id} className={cn(!device.active && "opacity-60")}>
                <CardContent className="py-4 space-y-3">
                  {/* Main row */}
                  <div className="flex items-center gap-4">
                    <div className="flex size-10 items-center justify-center rounded bg-muted shrink-0">
                      <Monitor className="size-5 text-muted-foreground" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusDot status={status} />
                        <span className="font-medium truncate">{device.name}</span>
                        {device.active ? (
                          <Badge variant="outline" size="sm">
                            {device.activated ? "Active" : "Pending activation"}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" size="sm">Deactivated</Badge>
                        )}
                        {status === "offline" && (
                          <Badge variant="orange" size="sm" title="No heartbeat in over 24 hours">
                            Offline
                          </Badge>
                        )}
                        {expiringSession && (
                          <Badge variant="orange" size="sm" title={`Session expires ${formatRelative(device.sessionExpiresAt)}`}>
                            Session expiring
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span>{device.location.name}</span>
                        {device.activated && (
                          <>
                            <span>·</span>
                            <span>Last seen: {formatRelative(device.lastSeenAt)}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      {!device.activated && device.active && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRegenerate(device)}
                          disabled={regeneratingId === device.id}
                          title="Regenerate activation code"
                        >
                          {regeneratingId === device.id ? <Spinner /> : <RefreshCw className="size-4" />}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggle(device)}
                        disabled={togglingId === device.id}
                        title={device.active ? "Deactivate" : "Activate"}
                      >
                        {togglingId === device.id ? (
                          <Spinner />
                        ) : device.active ? (
                          <PowerOff className="size-4" />
                        ) : (
                          <Power className="size-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(device)}
                        disabled={deletingId === device.id}
                        className="text-destructive hover:text-destructive"
                        title="Delete"
                      >
                        {deletingId === device.id ? <Spinner /> : <Trash2 className="size-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Health stats strip — only when activated */}
                  {device.activated && (
                    <div className="flex items-center gap-3 px-1 pt-1 border-t">
                      {/* Pending pickups */}
                      <button
                        type="button"
                        onClick={() => device.pendingPickupCount > 0 && setPickupDialog(device)}
                        className={cn(
                          "flex items-center gap-1.5 text-xs rounded px-2 py-1 transition-colors",
                          device.pendingPickupCount > 0
                            ? "text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 cursor-pointer"
                            : "text-muted-foreground cursor-default"
                        )}
                        title={device.pendingPickupCount > 0 ? "View and clear pending pickups" : "No pending pickups"}
                        disabled={device.pendingPickupCount === 0}
                      >
                        <ShoppingBag className="size-3.5" />
                        <span>{device.pendingPickupCount} pending pickup{device.pendingPickupCount !== 1 ? "s" : ""}</span>
                      </button>

                      <span className="w-px h-3 bg-border" />

                      {/* Open checkouts */}
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-2 py-1">
                        {device.openCheckoutCount > 0
                          ? <CheckCircle2 className="size-3.5 text-emerald-500" />
                          : <Circle className="size-3.5" />
                        }
                        <span>{device.openCheckoutCount} active checkout{device.openCheckoutCount !== 1 ? "s" : ""}</span>
                      </div>

                      {/* Session expiry */}
                      {device.sessionExpiresAt && (
                        <>
                          <span className="w-px h-3 bg-border" />
                          <div className={cn(
                            "flex items-center gap-1.5 text-xs px-2 py-1",
                            expiringSession ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                          )}>
                            <Clock className="size-3.5" />
                            <span>Session expires {formatRelative(device.sessionExpiresAt)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Activation code dialog — shown after creating a device */}
      <Dialog open={!!codeDialog} onOpenChange={() => setCodeDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kiosk Activation Code</DialogTitle>
            <DialogDescription>
              Enter this code on the iPad to activate <strong>{codeDialog?.name}</strong>. This code is shown only once.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center gap-3 py-6">
            <code className="text-4xl font-mono font-bold tracking-[0.3em] bg-muted px-6 py-3 rounded-lg">
              {codeDialog?.code}
            </code>
            <Button
              variant="outline"
              size="icon"
              onClick={() => codeDialog && copyCode(codeDialog.code)}
              title="Copy code"
            >
              <Copy className="size-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setCodeDialog(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pending pickup clear dialog */}
      <Dialog open={!!pickupDialog} onOpenChange={() => setPickupDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pending Pickups</DialogTitle>
            <DialogDescription>
              Pickups at <strong>{pickupDialog?.location.name}</strong> waiting to be collected. Cancel any that are stuck or expired.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1 max-h-72 overflow-y-auto">
            {(pickupDialog?.pendingPickups ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No pending pickups</p>
            )}
            {(pickupDialog?.pendingPickups ?? []).map((b) => (
              <div key={b.id} className="flex items-start gap-3 rounded-lg border px-3 py-2.5">
                <ShoppingBag className="size-4 mt-0.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{b.title}</p>
                  <p className="text-xs text-muted-foreground">{b.requesterName} &middot; {formatDate(b.startsAt)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                  onClick={() => handleCancelPickup(b)}
                  disabled={cancellingPickupId === b.id}
                  title="Cancel this pickup"
                >
                  {cancellingPickupId === b.id ? <Spinner /> : <X className="size-4" />}
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPickupDialog(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
    </FadeUp>
  );
}
