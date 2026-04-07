"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { handleAuthRedirect, parseErrorMessage } from "@/lib/errors";
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
  const { toast } = useToast();
  const confirm = useConfirm();
  const [mappings, setMappings] = useState<LocationMapping[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addingMapping, setAddingMapping] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingHome, setTogglingHome] = useState<string | null>(null);

  const loadMappings = useCallback(async () => {
    try {
      const res = await fetch("/api/location-mappings");
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        const json = await res.json();
        setMappings(json.data ?? []);
      }
    } catch {
      toast("Failed to load venue mappings", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadLocations = useCallback(async () => {
    try {
      const res = await fetch("/api/locations");
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        const json = await res.json();
        setLocations(json.data ?? []);
      }
    } catch {
      /* network error */
    }
  }, []);

  useEffect(() => {
    loadMappings();
    loadLocations();
  }, [loadMappings, loadLocations]);

  async function toggleHomeVenue(locationId: string, current: boolean) {
    setTogglingHome(locationId);
    // Optimistic
    setLocations((prev) => prev.map((l) => l.id === locationId ? { ...l, isHomeVenue: !current } : l));
    try {
      const res = await fetch(`/api/locations/${locationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isHomeVenue: !current }),
      });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) {
        setLocations((prev) => prev.map((l) => l.id === locationId ? { ...l, isHomeVenue: current } : l));
        toast("Failed to update", "error");
      }
    } catch {
      setLocations((prev) => prev.map((l) => l.id === locationId ? { ...l, isHomeVenue: current } : l));
      toast("Network error", "error");
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
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        setShowAdd(false);
        toast("Venue mapping added", "success");
        await loadMappings();
        e.currentTarget.reset();
      } else {
        const msg = await parseErrorMessage(res, "Failed to create mapping");
        toast(msg, "error");
      }
    } catch {
      toast("Network error — please try again.", "error");
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
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        toast("Venue mapping deleted", "success");
        await loadMappings();
      } else {
        toast("Delete failed", "error");
      }
    } catch {
      toast("Network error — please try again.", "error");
    }
    setDeletingId(null);
  }

  return (
    <div className="grid grid-cols-[260px_1fr] gap-8 items-start max-md:grid-cols-1 max-md:gap-4">
      <div className="sticky top-20 max-md:static">
        <h2>Venue Mappings</h2>
        <p className="text-sm text-muted-foreground">
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
            <CardContent className="py-10 text-center text-muted-foreground">
              No venue mappings configured. Add patterns to automatically assign locations to calendar events.
            </CardContent>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Pattern</th>
                    <th>Location</th>
                    <th>Priority</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map((m) => (
                    <tr key={m.id}>
                      <td className="font-mono text-xs">{m.pattern}</td>
                      <td>
                        <Badge variant="blue">{m.location.name}</Badge>
                      </td>
                      <td>{m.priority}</td>
                      <td style={{ textAlign: "right" }}>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteMapping(m.id)}
                          disabled={deletingId === m.id}
                        >
                          {deletingId === m.id ? "..." : "Delete"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
