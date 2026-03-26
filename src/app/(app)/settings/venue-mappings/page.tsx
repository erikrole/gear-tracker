"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

  const loadMappings = useCallback(async () => {
    try {
      const res = await fetch("/api/location-mappings");
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
      if (res.ok) {
        setShowAdd(false);
        toast("Venue mapping added", "success");
        await loadMappings();
        e.currentTarget.reset();
      } else {
        const json = await res.json().catch(() => ({}));
        toast(
          (json as Record<string, string>).error || "Failed to create mapping",
          "error"
        );
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
    <div className="settings-split">
      <div className="settings-sidebar">
        <h2>Venue Mappings</h2>
        <p className="text-sm text-muted-foreground">
          Map calendar venue names to your locations. When events sync from the calendar, these patterns determine which location each event belongs to.
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          <strong>Home vs Away:</strong> Events with &ldquo;vs&rdquo; in the title are marked as home games. Events with &ldquo;at&rdquo; are away. Venue mappings help assign the correct equipment location for each event.
        </p>
      </div>

      <div className="settings-main">
        <div className="action-row">
          {!showAdd && (
            <Button size="sm" onClick={() => setShowAdd(true)}>
              Add mapping
            </Button>
          )}
        </div>

        {showAdd && (
          <Card style={{ padding: 16, marginBottom: 16 }}>
            <form onSubmit={handleAddMapping}>
              <div className="flex flex-wrap gap-2 items-end">
                <Input
                  name="pattern"
                  placeholder="Pattern (regex or text)"
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
          </Card>
        )}

        {loading ? (
          <Card style={{ padding: 40, textAlign: "center" }}>
            <Spinner className="size-8" />
          </Card>
        ) : mappings.length === 0 ? (
          <Card
            style={{
              padding: 40,
              textAlign: "center",
              color: "var(--text-secondary)",
            }}
          >
            No venue mappings configured. Add patterns to automatically assign locations to calendar events (e.g., &ldquo;Camp Randall&rdquo; maps to your Camp Randall location).
          </Card>
        ) : (
          <Card>
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
          </Card>
        )}
      </div>
    </div>
  );
}
