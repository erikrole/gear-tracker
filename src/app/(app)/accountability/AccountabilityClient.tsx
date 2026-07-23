"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Download, MoreHorizontal, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import EmptyState from "@/components/EmptyState";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { handleAuthRedirect, parseJsonSafely } from "@/lib/errors";
import { useFetch } from "@/hooks/use-fetch";

type Incident = {
  incidentId: string;
  bookingId: string;
  title: string;
  dueAt: string;
  returnedAt: string | null;
  extendedAt: string | null;
  extendedTo: string | null;
  lateHours: number;
  state: "active" | "resolved" | "extended";
  location: { id: string; name: string };
  itemSummary: string;
};

type Person = {
  userId: string;
  name: string;
  active: boolean;
  primaryArea: string | null;
  checkoutCount: number;
  completedCount: number;
  lateEventCount: number;
  activeOverdueCount: number;
  totalLateHours: number;
  medianLateHours: number;
  onTimeRate: number | null;
  lastIncidentAt: string;
  incidents: Incident[];
};

type AccountabilityReport = {
  generatedAt: string;
  academicYear: { startYear: number; label: string; start: string; end: string } | null;
  methodology: {
    gracePeriodHours: number;
    minimumCheckoutsForRate: number;
    ranking: string;
  };
  metrics: {
    peopleNeedingAttention: number;
    lateEvents: number;
    activeOverdue: number;
    excludedRecords: number;
  };
  locations: Array<{ id: string; name: string }>;
  leaderboard: Person[];
  excluded: Array<{
    bookingId: string;
    bookingTitle: string;
    requester: string;
    dueAt: string;
    reason: string;
    note: string | null;
    excludedAt: string;
    excludedBy: string;
  }>;
};

const REASONS = [
  ["TEST_DATA", "Test data"],
  ["IMPORTED_BAD_DATA", "Imported bad data"],
  ["INCORRECT_TIMESTAMPS", "Incorrect timestamps"],
  ["DUPLICATE_RECORD", "Duplicate record"],
  ["OTHER", "Other"],
] as const;

function formatHours(hours: number) {
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const remainder = hours % 24;
  return remainder ? `${days}d ${remainder}h` : `${days}d`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function metric(label: string, value: number) {
  return (
    <Card elevation="flat">
      <CardContent className="py-5">
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

export default function AccountabilityClient() {
  const now = new Date();
  const currentStartYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  const [year, setYear] = useState(String(currentStartYear));
  const [locationId, setLocationId] = useState("all");
  const [incidentState, setIncidentState] = useState("all");
  const [userState, setUserState] = useState("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [excludeTarget, setExcludeTarget] = useState<Incident | null>(null);
  const [reason, setReason] = useState("TEST_DATA");
  const [note, setNote] = useState("");
  const mutationGuard = useRef(false);
  const [mutating, setMutating] = useState(false);

  const queryUrl = useMemo(() => {
    const params = new URLSearchParams({ year, state: incidentState, users: userState });
    if (locationId !== "all") params.set("locationId", locationId);
    return `/api/accountability?${params}`;
  }, [incidentState, locationId, userState, year]);

  const { data, loading, refreshing, error, reload } = useFetch<AccountabilityReport>({
    url: queryUrl,
    transform: (json) => json as unknown as AccountabilityReport,
    keepPreviousData: true,
  });

  const years = Array.from({ length: 5 }, (_, index) => currentStartYear - index);

  function toggle(userId: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function mutate(url: string, method: "POST" | "DELETE", body?: object) {
    if (mutationGuard.current) return false;
    mutationGuard.current = true;
    setMutating(true);
    try {
      const response = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (handleAuthRedirect(response, "/accountability")) return false;
      if (!response.ok) {
        const payload = await parseJsonSafely<{ error?: string }>(response);
        toast.error(payload?.error ?? "Accountability update failed.");
        return false;
      }
      reload();
      return true;
    } catch {
      toast.error("Accountability update failed. Check your connection and try again.");
      return false;
    } finally {
      mutationGuard.current = false;
      setMutating(false);
    }
  }

  async function submitExclusion() {
    if (!excludeTarget) return;
    const success = await mutate("/api/accountability/exclusions", "POST", {
      bookingId: excludeTarget.bookingId,
      reason,
      note: note.trim() || null,
    });
    if (success) {
      toast.success(`${excludeTarget.title} excluded from accountability.`);
      setExcludeTarget(null);
      setReason("TEST_DATA");
      setNote("");
    }
  }

  async function restore(bookingId: string, title: string) {
    const success = await mutate(`/api/accountability/exclusions/${bookingId}`, "DELETE");
    if (success) toast.success(`${title} restored to accountability.`);
  }

  function exportCsv() {
    const separator = queryUrl.includes("?") ? "&" : "?";
    window.location.assign(`${queryUrl}${separator}format=csv`);
  }

  if (loading && !data) {
    return <div className="space-y-4">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;
  }

  if (error && !data) {
    return (
      <EmptyState
        icon="wifi-off"
        title="Accountability data could not be loaded"
        description="Try again. No records were changed."
        actionLabel="Retry"
        onAction={reload}
      />
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <div className="min-w-40 space-y-1.5">
          <Label>Academic year</Label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map((start) => <SelectItem key={start} value={String(start)}>{start}-{String(start + 1).slice(-2)}</SelectItem>)}
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-40 space-y-1.5">
          <Label>Location</Label>
          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {data.locations.map((location) => <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-40 space-y-1.5">
          <Label>Incident state</Label>
          <Select value={incidentState} onValueChange={setIncidentState}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All late events</SelectItem>
              <SelectItem value="active">Active overdue</SelectItem>
              <SelectItem value="resolved">Resolved late returns</SelectItem>
              <SelectItem value="extended">Extended after overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-40 space-y-1.5">
          <Label>User status</Label>
          <Select value={userState} onValueChange={setUserState}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Active and inactive</SelectItem>
              <SelectItem value="active">Active users</SelectItem>
              <SelectItem value="inactive">Inactive users</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={data.leaderboard.length === 0}>
          <Download className="size-4" /> Export
        </Button>
        {refreshing && <span className="text-xs text-muted-foreground">Refreshing…</span>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metric("People needing attention", data.metrics.peopleNeedingAttention)}
        {metric("Late events", data.metrics.lateEvents)}
        {metric("Currently overdue", data.metrics.activeOverdue)}
        {metric("Excluded records", data.metrics.excludedRecords)}
      </div>

      <Alert>
        <AlertTitle>How this ranking works</AlertTitle>
        <AlertDescription>
          {data.methodology.ranking}. A checkout becomes late after its due time plus the configured {data.methodology.gracePeriodHours}-hour grace period.
          Extending an already-late checkout records a separate late event against the prior due time.
          On-time rate appears after {data.methodology.minimumCheckoutsForRate} completed checkouts. Exclusions affect this page only and never remove custody history.
        </AlertDescription>
      </Alert>

      <Card elevation="flat">
        <CardHeader>
          <CardTitle>Needs attention</CardTitle>
          <CardDescription>Evidence-first review of repeated late checkout behavior.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {data.leaderboard.length === 0 ? (
            <EmptyState icon="check" title="No late-return patterns in this view" description="Try another academic year or broaden the filters." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">Rank</TableHead>
                  <TableHead>Person</TableHead>
                  <TableHead className="text-right">Late events</TableHead>
                  <TableHead className="text-right">Currently overdue</TableHead>
                  <TableHead className="text-right">Total late</TableHead>
                  <TableHead className="text-right">Median</TableHead>
                  <TableHead className="text-right">On time</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.leaderboard.map((person, index) => {
                  const isExpanded = expanded.has(person.userId);
                  return [
                    <TableRow key={person.userId} className="cursor-pointer" onClick={() => toggle(person.userId)}>
                      <TableCell className="text-muted-foreground">#{index + 1}</TableCell>
                      <TableCell>
                        <Link href={`/users/${person.userId}`} onClick={(event) => event.stopPropagation()} className="font-semibold hover:underline">{person.name}</Link>
                        <div className="text-xs text-muted-foreground">{person.primaryArea?.replaceAll("_", " ") ?? "No area"} · {person.checkoutCount} checkouts{!person.active ? " · Inactive" : ""}</div>
                      </TableCell>
                      <TableCell className="text-right"><Badge variant="red">{person.lateEventCount}</Badge></TableCell>
                      <TableCell className="text-right">{person.activeOverdueCount || "—"}</TableCell>
                      <TableCell className="text-right font-medium">{formatHours(person.totalLateHours)}</TableCell>
                      <TableCell className="text-right">{formatHours(person.medianLateHours)}</TableCell>
                      <TableCell className="text-right">{person.onTimeRate === null ? "Not enough data" : `${person.onTimeRate}%`}</TableCell>
                      <TableCell>{isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}</TableCell>
                    </TableRow>,
                    ...(isExpanded ? person.incidents.map((incident) => (
                      <TableRow key={incident.incidentId} className="bg-muted/30">
                        <TableCell />
                        <TableCell colSpan={3}>
                          <Link href={`/checkouts/${incident.bookingId}`} className="font-medium hover:underline">{incident.title}</Link>
                          <div className="text-xs text-muted-foreground">{incident.location.name} · Due {formatDate(incident.dueAt)}{incident.itemSummary ? ` · ${incident.itemSummary}` : ""}</div>
                        </TableCell>
                        <TableCell className="text-right">{formatHours(incident.lateHours)}</TableCell>
                        <TableCell className="text-right" colSpan={2}>
                          <Badge variant={incident.state === "active" ? "red" : "secondary"}>
                            {incident.state === "active"
                              ? "Currently overdue"
                              : incident.state === "extended"
                                ? `Extended ${formatDate(incident.extendedAt!)} to ${formatDate(incident.extendedTo!)}`
                                : `Returned ${formatDate(incident.returnedAt!)}`}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={(event) => event.stopPropagation()} aria-label={`Actions for ${incident.title}`}><MoreHorizontal className="size-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => setExcludeTarget(incident)}>Exclude from accountability</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )) : []),
                  ];
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card elevation="flat">
        <CardHeader>
          <CardTitle>Excluded records</CardTitle>
          <CardDescription>Reversible data-quality exceptions for this filtered period.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.excluded.length === 0 ? (
            <p className="text-sm text-muted-foreground">No records are excluded in this view.</p>
          ) : (
            <div className="divide-y">
              {data.excluded.map((entry) => (
                <div key={entry.bookingId} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <Link href={`/checkouts/${entry.bookingId}`} className="font-medium hover:underline">{entry.bookingTitle}</Link>
                    <p className="text-sm text-muted-foreground">{entry.requester} · {entry.reason.replaceAll("_", " ").toLowerCase()} · excluded by {entry.excludedBy}</p>
                    {entry.note && <p className="text-sm">{entry.note}</p>}
                  </div>
                  <Button variant="outline" onClick={() => restore(entry.bookingId, entry.bookingTitle)} disabled={mutating}>
                    <RotateCcw className="size-4" /> Restore
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={excludeTarget !== null} onOpenChange={(open) => { if (!open && !mutating) setExcludeTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <div>
              <DialogTitle>Exclude checkout from accountability</DialogTitle>
              <DialogDescription>This keeps the checkout and all custody evidence intact.</DialogDescription>
            </div>
          </DialogHeader>
          <DialogBody className="space-y-4 py-5">
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{REASONS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="accountability-note">Explanation {reason === "OTHER" ? "(required)" : "(optional)"}</Label>
              <Textarea id="accountability-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcludeTarget(null)} disabled={mutating}>Cancel</Button>
            <Button onClick={submitExclusion} disabled={mutating || (reason === "OTHER" && !note.trim())}>{mutating ? "Excluding…" : "Exclude record"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
