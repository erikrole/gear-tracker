"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Plus, Power, PowerOff, WifiOff } from "lucide-react";
import { FadeUp } from "@/components/ui/motion";
import { useConfirm } from "@/components/ConfirmDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useFetch } from "@/hooks/use-fetch";
import {
  classifyError,
  handleAuthRedirect,
  isAbortError,
  parseErrorMessage,
} from "@/lib/errors";

type LocationCounts = {
  users: number;
  assets: number;
  bookings: number;
  kioskDevices: number;
  locationMappings: number;
};

type Location = {
  id: string;
  name: string;
  address: string | null;
  active: boolean;
  isHomeVenue: boolean;
  _count?: LocationCounts;
};

function describeUsage(c?: LocationCounts): string {
  if (!c) return "";
  const parts: string[] = [];
  if (c.assets) parts.push(`${c.assets} item${c.assets === 1 ? "" : "s"}`);
  if (c.bookings) parts.push(`${c.bookings} booking${c.bookings === 1 ? "" : "s"}`);
  if (c.kioskDevices) parts.push(`${c.kioskDevices} kiosk${c.kioskDevices === 1 ? "" : "s"}`);
  if (c.locationMappings) parts.push(`${c.locationMappings} venue map${c.locationMappings === 1 ? "" : "s"}`);
  if (c.users) parts.push(`${c.users} user${c.users === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

export default function LocationsSettingsPage() {
  const confirm = useConfirm();
  const { data: fetched, loading, error, reload } = useFetch<Location[]>({
    url: "/api/locations?includeInactive=1",
    returnTo: "/settings/locations",
    transform: (json) => (json.data as Location[]) ?? [],
  });

  const [localItems, setLocalItems] = useState<Location[] | null>(null);
  const [prevFetched, setPrevFetched] = useState(fetched);
  if (fetched !== prevFetched) {
    setPrevFetched(fetched);
    setLocalItems(null);
  }
  const items = localItems ?? fetched ?? [];

  const [busy, setBusy] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Add form
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newHome, setNewHome] = useState(false);
  const [adding, setAdding] = useState(false);

  function patchLocal(id: string, patch: Partial<Location>) {
    setLocalItems((prev) => (prev ?? items).map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          address: newAddress.trim() || undefined,
          isHomeVenue: newHome,
        }),
      });
      if (handleAuthRedirect(res, "/settings/locations")) return;
      if (res.ok) {
        toast.success(`Added "${newName.trim()}"`);
        setNewName("");
        setNewAddress("");
        setNewHome(false);
        setShowAdd(false);
        reload();
      } else {
        const msg = await parseErrorMessage(res, "Failed to create location");
        toast.error(msg);
      }
    } catch (err) {
      if (isAbortError(err)) return;
      const kind = classifyError(err);
      toast.error(kind === "network" ? "You’re offline. Check your connection." : "Failed to create location");
    }
    setAdding(false);
  }

  async function patchLocation(id: string, patch: Partial<Location>, optimistic = true) {
    if (optimistic) patchLocal(id, patch);
    try {
      const res = await fetch(`/api/locations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (handleAuthRedirect(res, "/settings/locations")) return false;
      if (!res.ok) {
        const msg = await parseErrorMessage(res, "Failed to save");
        toast.error(msg);
        if (optimistic) reload();
        return false;
      }
      return true;
    } catch (err) {
      if (isAbortError(err)) return false;
      const kind = classifyError(err);
      toast.error(kind === "network" ? "You’re offline. Check your connection." : "Failed to save");
      if (optimistic) reload();
      return false;
    }
  }

  async function toggleHome(loc: Location) {
    setBusy(`home-${loc.id}`);
    await patchLocation(loc.id, { isHomeVenue: !loc.isHomeVenue });
    setBusy(null);
  }

  async function toggleActive(loc: Location) {
    if (loc.active) {
      const usage = describeUsage(loc._count);
      const ok = await confirm({
        title: `Deactivate "${loc.name}"?`,
        message: usage
          ? `This location is referenced by ${usage}. Deactivating hides it from new pickers but keeps existing references intact. You can reactivate later.`
          : "Hide this location from new pickers? Existing references stay intact.",
        confirmLabel: "Deactivate",
        variant: "danger",
      });
      if (!ok) return;
    }
    setBusy(`active-${loc.id}`);
    const success = await patchLocation(loc.id, { active: !loc.active });
    if (success) {
      toast.success(`${loc.name} ${loc.active ? "deactivated" : "reactivated"}`);
    }
    setBusy(null);
  }

  function startRename(loc: Location) {
    setRenamingId(loc.id);
    setRenameValue(loc.name);
  }

  async function commitRename(loc: Location) {
    const next = renameValue.trim();
    if (!next || next === loc.name) {
      setRenamingId(null);
      return;
    }
    setBusy(`rename-${loc.id}`);
    const success = await patchLocation(loc.id, { name: next });
    if (success) toast.success(`Renamed to "${next}"`);
    setRenamingId(null);
    setBusy(null);
  }

  const sidebar = (
    <div className="sticky top-20 max-md:static">
      <h2 className="text-2xl font-bold mb-2">Locations</h2>
      <p className="text-sm text-muted-foreground leading-relaxed">
        Catalog of physical locations referenced by items, kiosks, calendar
        events, and venue mappings. Mark a location as a home venue to flag
        events held there as home games for shift coverage.
      </p>
    </div>
  );

  if (loading) {
    return (
      <FadeUp>
        <div className="grid grid-cols-[260px_1fr] gap-8 items-start max-md:grid-cols-1 max-md:gap-4">
          {sidebar}
          <div className="min-w-0 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-md" />
            ))}
          </div>
        </div>
      </FadeUp>
    );
  }

  if (error) {
    const Icon = error === "network" ? WifiOff : AlertTriangle;
    return (
      <FadeUp>
        <div className="grid grid-cols-[260px_1fr] gap-8 items-start max-md:grid-cols-1 max-md:gap-4">
          {sidebar}
          <div className="min-w-0">
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
                <Icon className="size-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {error === "network"
                    ? "Could not connect to the server."
                    : "Failed to load locations."}
                </p>
                <Button variant="outline" onClick={reload}>
                  Retry
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </FadeUp>
    );
  }

  const active = items.filter((l) => l.active);
  const inactive = items.filter((l) => !l.active);

  return (
    <FadeUp>
    <div className="grid grid-cols-[260px_1fr] gap-8 items-start max-md:grid-cols-1 max-md:gap-4">
      {sidebar}

      <div className="min-w-0 space-y-4">
        <div className="flex justify-end">
          {!showAdd && (
            <Button size="sm" onClick={() => setShowAdd(true)}>
              <Plus className="size-4 mr-1.5" />
              Add location
            </Button>
          )}
        </div>

        {showAdd && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">New location</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="grid grid-cols-[1fr_1fr] gap-3 max-sm:grid-cols-1">
                  <div className="space-y-1.5">
                    <Label htmlFor="loc-name">Name</Label>
                    <Input
                      id="loc-name"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g. Camp Randall Stadium"
                      required
                      autoFocus
                      disabled={adding}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="loc-address">Address (optional)</Label>
                    <Input
                      id="loc-address"
                      value={newAddress}
                      onChange={(e) => setNewAddress(e.target.value)}
                      placeholder="1440 Monroe St, Madison, WI"
                      disabled={adding}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="loc-home"
                    checked={newHome}
                    onCheckedChange={setNewHome}
                    disabled={adding}
                  />
                  <Label htmlFor="loc-home" className="text-sm font-medium">
                    Home venue
                  </Label>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={adding || !newName.trim()}>
                    {adding ? <><Spinner data-icon="inline-start" />Adding...</> : "Add location"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => { setShowAdd(false); setNewName(""); setNewAddress(""); setNewHome(false); }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-base">
              Active locations ({active.length})
            </CardTitle>
          </CardHeader>
          {active.length === 0 ? (
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No locations yet. Add one to get started.
            </CardContent>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Home venue</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {active.map((loc) => (
                  <TableRow key={loc.id}>
                    <TableCell className="align-top">
                      {renamingId === loc.id ? (
                        <Input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => commitRename(loc)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitRename(loc);
                            if (e.key === "Escape") setRenamingId(null);
                          }}
                          disabled={busy === `rename-${loc.id}`}
                          autoFocus
                          className="h-8 max-w-[260px]"
                        />
                      ) : (
                        <button
                          type="button"
                          className="text-left font-medium hover:text-[var(--wi-red)] transition-colors"
                          onClick={() => startRename(loc)}
                          title="Click to rename"
                        >
                          {loc.name}
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground align-top">
                      {loc.address || "—"}
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex items-center gap-2">
                        {loc.isHomeVenue && <Badge variant="green" size="sm">Home</Badge>}
                        <Switch
                          checked={loc.isHomeVenue}
                          onCheckedChange={() => toggleHome(loc)}
                          disabled={busy === `home-${loc.id}`}
                          aria-label="Toggle home venue"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right align-top">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActive(loc)}
                        disabled={busy === `active-${loc.id}`}
                        title="Deactivate"
                      >
                        {busy === `active-${loc.id}` ? <Spinner /> : <PowerOff className="size-4" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        {inactive.length > 0 && (
          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="text-base text-muted-foreground">
                Deactivated ({inactive.length})
              </CardTitle>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Still referenced by</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inactive.map((loc) => (
                  <TableRow key={loc.id} className="opacity-70">
                    <TableCell className="font-medium">{loc.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {describeUsage(loc._count) || "Nothing"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActive(loc)}
                        disabled={busy === `active-${loc.id}`}
                        title="Reactivate"
                      >
                        {busy === `active-${loc.id}` ? <Spinner /> : <Power className="size-4" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
    </FadeUp>
  );
}
