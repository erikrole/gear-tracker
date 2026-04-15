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
  Copy,
  Monitor,
  Plus,
  Power,
  PowerOff,
  Trash2,
  WifiOff,
} from "lucide-react";
import { handleAuthRedirect, parseErrorMessage } from "@/lib/errors";
import { useFetch } from "@/hooks/use-fetch";
import { formatRelativeTime } from "@/lib/format";

type KioskDevice = {
  id: string;
  name: string;
  locationId: string;
  location: { id: string; name: string };
  active: boolean;
  activated: boolean;
  activatedAt: string | null;
  lastSeenAt: string | null;
  createdAt: string;
};

type LocationOption = { id: string; name: string };
type ErrorState = { type: "network" | "server" | "auth"; message: string };

export default function KioskDevicesPage() {
  const confirm = useConfirm();

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Add form
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addLocationId, setAddLocationId] = useState("");
  const [adding, setAdding] = useState(false);

  // Activation code display
  const [codeDialog, setCodeDialog] = useState<{
    name: string;
    code: string;
  } | null>(null);

  const {
    data: devices,
    loading,
    error: fetchError,
    reload: load,
  } = useFetch<KioskDevice[]>({ url: "/api/kiosk-devices" });

  const { data: formOptions } = useFetch<{ locations: LocationOption[] }>({
    url: "/api/form-options",
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
      if (handleAuthRedirect(res)) return;
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
    } catch {
      toast.error("Could not connect to server");
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
      if (res.ok) {
        toast.success(`Kiosk ${action}d`);
        load();
      } else {
        toast.error(`Failed to ${action} kiosk`);
      }
    } catch {
      toast.error("Could not connect to server");
    } finally {
      setTogglingId(null);
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
      if (res.ok) {
        toast.success("Kiosk device deleted");
        load();
      } else {
        toast.error("Failed to delete kiosk device");
      }
    } catch {
      toast.error("Could not connect to server");
    } finally {
      setDeletingId(null);
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

  return (
    <FadeUp>
    <div className="grid grid-cols-[260px_1fr] gap-8 items-start max-md:grid-cols-1 max-md:gap-4">
      <div className="sticky top-20 max-md:static">
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

      {/* Device list */}
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

      {!loading && !error && (devices ?? []).length > 0 && (
        <div className="space-y-3">
          {(devices ?? []).map((device) => (
            <Card key={device.id} className={!device.active ? "opacity-60" : ""}>
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex size-10 items-center justify-center rounded bg-muted">
                  <Monitor className="size-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{device.name}</span>
                    {device.active ? (
                      <Badge variant="outline" className="text-xs">
                        {device.activated ? "Active" : "Pending activation"}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        Deactivated
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
                <div className="flex items-center gap-1">
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
                    {deletingId === device.id ? (
                      <Spinner />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Activation code dialog — shown after creating a device */}
      <Dialog open={!!codeDialog} onOpenChange={() => setCodeDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kiosk Activation Code</DialogTitle>
            <DialogDescription>
              Enter this code on the iPad at <strong>/kiosk</strong> to activate{" "}
              <strong>{codeDialog?.name}</strong>. This code is shown only once.
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
      </div>
    </div>
    </FadeUp>
  );
}
