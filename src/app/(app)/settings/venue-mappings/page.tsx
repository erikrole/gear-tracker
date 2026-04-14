"use client";

import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { FadeUp } from "@/components/ui/motion";
import { useFetch } from "@/hooks/use-fetch";
import { handleAuthRedirect, classifyError, isAbortError, parseErrorMessage } from "@/lib/errors";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type LocationMapping = {
  id: string;
  pattern: string;
  priority: number;
  location: { id: string; name: string };
};

type Location = {
  id: string;
  name: string;
  isHomeVenue: boolean;
};

export default function VenueMappingsPage() {
  const confirm = useConfirm();
  const { data: fetchedMappings, loading, reload: reloadMappings } = useFetch<LocationMapping[]>({
    url: "/api/location-mappings",
    returnTo: "/settings/venue-mappings",
    transform: (json) => (json.data as LocationMapping[]) ?? [],
  });
  const { data: fetchedLocations } = useFetch<Location[]>({
    url: "/api/locations",
    returnTo: "/settings/venue-mappings",
    transform: (json) => (json.data as Location[]) ?? [],
  });

  // Local state for optimistic mutation updates
  const [localMappings, setLocalMappings] = useState<LocationMapping[] | null>(null);
  const mappings = localMappings ?? fetchedMappings ?? [];
  const [prevFetchedMappings, setPrevFetchedMappings] = useState(fetchedMappings);
  if (fetchedMappings !== prevFetchedMappings) {
    setPrevFetchedMappings(fetchedMappings);
    setLocalMappings(null);
  }

  const [localLocations, setLocalLocations] = useState<Location[] | null>(null);
  const locations = localLocations ?? fetchedLocations ?? [];
  const [prevFetchedLocations, setPrevFetchedLocations] = useState(fetchedLocations);
  if (fetchedLocations !== prevFetchedLocations) {
    setPrevFetchedLocations(fetchedLocations);
    setLocalLocations(null);
  }

  const [showAdd, setShowAdd] = useState(false);
  const [addingMapping, setAddingMapping] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingHome, setTogglingHome] = useState<string | null>(null);

  async function toggleHomeVenue(locationId: string, current: boolean) {
    setTogglingHome(locationId);
    // Optimistic
    setLocalLocations((prev) => (prev ?? locations).map((l) => l.id === locationId ? { ...l, isHomeVenue: !current } : l));
    try {
      const res = await fetch(`/api/locations/${locationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isHomeVenue: !current }),
      });
      if (handleAuthRedirect(res, "/settings/venue-mappings")) return;
      if (!res.ok) {
        setLocalLocations((prev) => (prev ?? locations).map((l) => l.id === locationId ? { ...l, isHomeVenue: current } : l));
        toast.error("Failed to update");
      }
    } catch (err) {
      if (isAbortError(err)) return;
      setLocalLocations((prev) => (prev ?? locations).map((l) => l.id === locationId ? { ...l, isHomeVenue: current } : l));
      const kind = classifyError(err);
      toast.error(kind === "network" ? "You\u2019re offline. Check your connection." : "Failed to update");
    }
    setTogglingHome(null);
  }

  async function handleAddMapping(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAddingMapping(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/location-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pattern: form.get("pattern"),
          locationId: form.get("locationId"),
          priority: parseInt(form.get("priority") as string) || 0,
        }),
      });
      if (handleAuthRedirect(res, "/settings/venue-mappings")) return;
      if (res.ok) {
        setShowAdd(false);
        toast.success("Venue mapping added");
        reloadMappings();
        e.currentTarget.reset();
      } else {
        const msg = await parseErrorMessage(res, "Failed to create mapping");
        toast.error(msg);
      }
    } catch (err) {
      if (isAbortError(err)) return;
      const kind = classifyError(err);
      toast.error(kind === "network" ? "You\u2019re offline. Check your connection." : "Failed to create mapping");
    }
    setAddingMapping(false);
  }

  async function handleDeleteMapping(id: string) {
    const ok = await confirm({
      title: "Delete venue mapping",
      message: "Delete this venue mapping?",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/location-mappings/${id}`, {
        method: "DELETE",
      });
      if (handleAuthRedirect(res, "/settings/venue-mappings")) return;
      if (res.ok) {
        toast.success("Venue mapping deleted");
        reloadMappings();
      } else {
        toast.error("Delete failed");
      }
    } catch (err) {
      if (isAbortError(err)) return;
      const kind = classifyError(err);
      toast.error(kind === "network" ? "You\u2019re offline. Check your connection." : "Delete failed");
    }
    setDeletingId(null);
  }

  return (
    <FadeUp>
    <div className="grid grid-cols-[260px_1fr] gap-8 items-start max-md:grid-cols-1 max-md:gap-4">
      <div className="sticky top-20 max-md:static">
        <h2 className="text-2xl font-bold mb-2">Venue Mappings</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Configure home venues and map calendar venue text to locations. Events at home venues are automatically marked as home games.
        </p>
      </div>

      <div className="min-w-0">
        {/* ── Home Venues ── */}
        <Card className="mb-4">
          <CardHeader><CardTitle>Home Venues</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Toggle which locations are home venues. Events mapped to a home venue are marked as home games for shift coverage.
            </p>
            {locations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No locations configured.</p>
            ) : (
              <div className="space-y-2">
                {locations.map((loc) => (
                  <div key={loc.id} className="flex items-center justify-between py-1.5">
                    <span className="text-sm font-medium">{loc.name}</span>
                    <div className="flex items-center gap-2">
                      {loc.isHomeVenue && <Badge variant="green" size="sm">Home</Badge>}
                      <Switch
                        checked={loc.isHomeVenue}
                        onCheckedChange={() => toggleHomeVenue(loc.id, loc.isHomeVenue)}
                        disabled={togglingHome === loc.id}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Venue Pattern Mappings ── */}
        <Card>
          <CardHeader>
            <CardTitle>Pattern Mappings</CardTitle>
            {!showAdd && (
              <Button size="sm" onClick={() => setShowAdd(true)}>
                Add mapping
              </Button>
            )}
          </CardHeader>

          {showAdd && (
            <CardContent>
              <form onSubmit={handleAddMapping}>
                <div className="flex flex-wrap gap-2 items-end">
                  <Input
                    name="pattern"
                    placeholder="Venue pattern (e.g. Camp Randall)"
                    required
                    className="flex-[2] min-w-[150px]"
                  />
                  <Select name="locationId" required defaultValue="">
                    <SelectTrigger className="flex-1 min-w-[120px]">
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
                  <Input
                    name="priority"
                    type="number"
                    defaultValue="0"
                    placeholder="Priority"
                    className="w-20"
                    title="Higher priority mappings are checked first"
                  />
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={addingMapping}>
                      {addingMapping ? "Adding..." : "Add"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAdd(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          )}

          {loading ? (
            <CardContent className="py-10 text-center">
              <Spinner className="size-8" />
            </CardContent>
          ) : mappings.length === 0 ? (
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              No venue mappings configured. Add patterns to automatically assign locations to calendar events.
            </CardContent>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pattern</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs">{m.pattern}</TableCell>
                    <TableCell>
                      <Badge variant="blue">{m.location.name}</Badge>
                    </TableCell>
                    <TableCell>{m.priority}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteMapping(m.id)}
                        disabled={deletingId === m.id}
                      >
                        {deletingId === m.id ? "..." : "Delete"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
    </FadeUp>
  );
}
