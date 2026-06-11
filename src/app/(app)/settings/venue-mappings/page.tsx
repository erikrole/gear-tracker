"use client";

import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import { OperationalRowActions } from "@/components/OperationalRowActions";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useFetch } from "@/hooks/use-fetch";
import { handleAuthRedirect, classifyError, isAbortError, parseErrorMessage } from "@/lib/errors";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SettingsPageShell } from "../SettingsPageShell";
import { Trash2 } from "lucide-react";

type LocationMapping = {
  id: string;
  pattern: string;
  priority: number;
  location: { id: string; name: string };
};

type Location = { id: string; name: string };

export default function VenueMappingsPage() {
  const confirm = useConfirm();
  const { data: fetchedMappings, loading, reload: reloadMappings } = useFetch<LocationMapping[]>({
    url: "/api/location-mappings",
    returnTo: "/settings/venue-mappings",
    transform: (json) => (json.data as LocationMapping[]) ?? [],
  });
  const {
    data: fetchedLocations,
    loading: locationsLoading,
    error: locationsError,
    reload: reloadLocations,
  } = useFetch<Location[]>({
    url: "/api/locations",
    returnTo: "/settings/venue-mappings",
    transform: (json) => (json.data as Location[]) ?? [],
  });

  const mappings = fetchedMappings ?? [];
  const locations = fetchedLocations ?? [];
  const locationsUnavailable = locationsLoading || Boolean(locationsError) || locations.length === 0;

  const [showAdd, setShowAdd] = useState(false);
  const [addingMapping, setAddingMapping] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Live regex tester — pure client-side (the regex is the user's input).
  const [testPattern, setTestPattern] = useState("");
  const [testSample, setTestSample] = useState("");
  type RegexTest =
    | { kind: "empty" }
    | { kind: "invalid"; reason: string }
    | { kind: "match"; matchText: string }
    | { kind: "no-match" };

  function evalRegex(pattern: string, sample: string): RegexTest {
    if (!pattern.trim()) return { kind: "empty" };
    let re: RegExp;
    try {
      re = new RegExp(pattern, "i");
    } catch (err) {
      return { kind: "invalid", reason: err instanceof Error ? err.message : "Invalid regex" };
    }
    if (!sample) return { kind: "empty" };
    const match = sample.match(re);
    if (match) return { kind: "match", matchText: match[0] };
    return { kind: "no-match" };
  }
  const testResult = evalRegex(testPattern, testSample);

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

  async function handleDeleteMapping(mapping: LocationMapping) {
    const ok = await confirm({
      title: "Delete venue mapping",
      message: `Delete the "${mapping.pattern}" mapping to ${mapping.location.name}? Future synced events matching this venue text will not auto-assign this location.`,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    setDeletingId(mapping.id);
    try {
      const res = await fetch(`/api/location-mappings/${mapping.id}`, {
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
    <SettingsPageShell
      title="Venue Mappings"
      description="Map raw venue text from calendar feeds to one of your locations. Home-location matches flag events as home games for shift coverage. Manage locations on the Locations tab."
    >
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
                    onChange={(e) => setTestPattern(e.target.value)}
                  />
                  <Select name="locationId" required defaultValue="">
                    <SelectTrigger className="flex-1 min-w-[120px]" disabled={locationsUnavailable}>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {locations.map((loc) => (
                          <SelectItem key={loc.id} value={loc.id}>
                            {loc.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
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
                    <Button type="submit" size="sm" disabled={addingMapping || locationsUnavailable}>
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

                {locationsError ? (
                  <Alert variant="destructive" className="mt-3">
                    <AlertDescription className="flex flex-wrap items-center gap-2">
                      <span>Locations could not load, so new venue mappings cannot be assigned yet.</span>
                      <Button type="button" size="sm" variant="outline" onClick={reloadLocations}>
                        Retry locations
                      </Button>
                    </AlertDescription>
                  </Alert>
                ) : locations.length === 0 && !locationsLoading ? (
                  <Alert className="mt-3">
                    <AlertDescription>
                      Add an active location before creating venue mappings.
                    </AlertDescription>
                  </Alert>
                ) : null}

                {/* Inline regex tester — appears alongside the Add form */}
                <div className="mt-3 rounded-md border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="vm-test-sample" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Test pattern
                    </label>
                    <span
                      className={`text-xs font-medium ${
                        testResult.kind === "match"
                          ? "text-[var(--green)]"
                          : testResult.kind === "invalid"
                            ? "text-destructive"
                            : "text-muted-foreground"
                      }`}
                    >
                      {testResult.kind === "empty" && "Type a pattern + sample text below"}
                      {testResult.kind === "invalid" && `✗ Invalid regex: ${testResult.reason}`}
                      {testResult.kind === "match" && `✓ Matches "${testResult.matchText}"`}
                      {testResult.kind === "no-match" && "✗ Does not match"}
                    </span>
                  </div>
                  <Input
                    id="vm-test-sample"
                    type="text"
                    value={testSample}
                    onChange={(e) => setTestSample(e.target.value)}
                    placeholder='Sample venue text — e.g. "Camp Randall Stadium · Madison, WI"'
                    className="h-8 text-sm"
                  />
                </div>
              </form>
            </CardContent>
          )}

          {loading ? (
            <CardContent className="py-10 text-center">
              <Spinner className="size-8" />
            </CardContent>
          ) : mappings.length === 0 ? (
            <CardContent className="py-0">
              <EmptyState
                inline
                icon="calendar"
                title="No venue mappings configured"
                description="Add patterns to automatically assign raw calendar venue text to locations."
              />
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
                      <OperationalRowActions
                        label={`Actions for ${m.pattern}`}
                        icon={deletingId === m.id ? <Spinner /> : undefined}
                      >
                        <DropdownMenuItem
                          onSelect={() => handleDeleteMapping(m)}
                          disabled={deletingId === m.id}
                          variant="destructive"
                        >
                          <Trash2 className="size-4" />
                          Delete mapping
                        </DropdownMenuItem>
                      </OperationalRowActions>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
    </SettingsPageShell>
  );
}
