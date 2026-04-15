"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Star, Trash2, AlertCircle } from "lucide-react";
import { useFetch } from "@/hooks/use-fetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getInitials } from "@/lib/avatar";
import { handleAuthRedirect, parseErrorMessage } from "@/lib/errors";

/* ── Types ──────────────────────────────────────────────── */

type TravelUser = {
  id: string;
  name: string;
  role: string;
  primaryArea: string | null;
  avatarUrl: string | null;
};

type TravelMember = {
  id: string;
  eventId: string;
  userId: string;
  notes: string | null;
  createdAt: string;
  user: TravelUser;
};

type RosterEntry = {
  id: string; // assignment id
  userId: string;
  sportCode: string;
  defaultTraveler: boolean;
  user: { id: string; name: string; role: string; primaryArea: string | null };
};

/* ── Roster picker ──────────────────────────────────────── */

function RosterPicker({
  sportCode,
  eventId,
  currentMemberIds,
  onAdded,
  onClose,
}: {
  sportCode: string;
  eventId: string;
  currentMemberIds: Set<string>;
  onAdded: (member: TravelMember) => void;
  onClose: () => void;
}) {
  const [adding, setAdding] = useState<string | null>(null);
  const [toggleing, setToggling] = useState<string | null>(null);
  const [localRoster, setLocalRoster] = useState<RosterEntry[] | null>(null);

  const { data: fetchedRoster, loading } = useFetch<RosterEntry[]>({
    url: `/api/sport-configs/${sportCode}/roster`,
    transform: (json) => (json.data as RosterEntry[]) ?? [],
  });

  const [prevFetched, setPrevFetched] = useState(fetchedRoster);
  if (fetchedRoster !== prevFetched) {
    setPrevFetched(fetchedRoster);
    setLocalRoster(null);
  }

  const roster = localRoster ?? fetchedRoster ?? [];

  // Default travelers first, then alphabetical
  const sorted = [...roster].sort((a, b) => {
    if (a.defaultTraveler && !b.defaultTraveler) return -1;
    if (!a.defaultTraveler && b.defaultTraveler) return 1;
    return a.user.name.localeCompare(b.user.name);
  });

  async function handleAdd(userId: string) {
    setAdding(userId);
    try {
      const res = await fetch(`/api/calendar-events/${eventId}/travel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) {
        const msg = await parseErrorMessage(res, "Failed to add");
        toast.error(msg);
        return;
      }
      const json = await res.json();
      onAdded(json.data);
      onClose();
    } catch {
      toast.error("Network error");
    } finally {
      setAdding(null);
    }
  }

  async function handleToggleDefault(entry: RosterEntry) {
    setToggling(entry.id);
    try {
      const res = await fetch(`/api/sport-configs/${sportCode}/roster`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId: entry.id, defaultTraveler: !entry.defaultTraveler }),
      });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) {
        toast.error("Failed to update");
        return;
      }
      setLocalRoster((prev) =>
        (prev ?? fetchedRoster ?? []).map((r) =>
          r.id === entry.id ? { ...r, defaultTraveler: !entry.defaultTraveler } : r
        )
      );
    } catch {
      toast.error("Network error");
    } finally {
      setToggling(null);
    }
  }

  if (loading) {
    return (
      <div className="p-2 space-y-2">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
      </div>
    );
  }

  const eligible = sorted.filter((r) => !currentMemberIds.has(r.userId));

  if (eligible.length === 0) {
    return (
      <p className="p-3 text-sm text-muted-foreground">
        All sport roster members are already on the travel roster.
      </p>
    );
  }

  return (
    <div className="max-h-60 overflow-y-auto">
      {eligible.map((entry) => (
        <div
          key={entry.id}
          className="flex items-center justify-between px-2 py-1.5 hover:bg-muted/50 rounded"
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleToggleDefault(entry)}
                  disabled={toggleing === entry.id}
                  className={`shrink-0 transition-colors ${
                    entry.defaultTraveler
                      ? "text-amber-400 hover:text-amber-500"
                      : "text-muted-foreground/30 hover:text-muted-foreground"
                  }`}
                  aria-label={entry.defaultTraveler ? "Remove default traveler" : "Mark as default traveler"}
                >
                  <Star className="size-3.5" fill={entry.defaultTraveler ? "currentColor" : "none"} />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {entry.defaultTraveler ? "Default traveler — click to unset" : "Mark as default traveler"}
              </TooltipContent>
            </Tooltip>
            <span className="text-sm truncate">{entry.user.name}</span>
            <Badge variant="gray" className="text-[10px] h-4 px-1 shrink-0">
              {entry.user.role}
            </Badge>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs ml-2 shrink-0"
            onClick={() => handleAdd(entry.userId)}
            disabled={adding !== null}
          >
            {adding === entry.userId ? "…" : "Add"}
          </Button>
        </div>
      ))}
    </div>
  );
}

/* ── Main Card ──────────────────────────────────────────── */

export function EventTravelCard({
  eventId,
  sportCode,
  isStaff,
}: {
  eventId: string;
  sportCode: string;
  isStaff: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [localMembers, setLocalMembers] = useState<TravelMember[] | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const {
    data: fetchedMembers,
    loading,
    error,
    reload,
  } = useFetch<TravelMember[]>({
    url: `/api/calendar-events/${eventId}/travel`,
    transform: (json) => (json.data as TravelMember[]) ?? [],
  });

  const [prevFetched, setPrevFetched] = useState(fetchedMembers);
  if (fetchedMembers !== prevFetched) {
    setPrevFetched(fetchedMembers);
    setLocalMembers(null);
  }

  const members = localMembers ?? fetchedMembers ?? [];
  const memberIds = new Set(members.map((m) => m.userId));

  function handleAdded(member: TravelMember) {
    setLocalMembers((prev) => [...(prev ?? fetchedMembers ?? []), member]);
  }

  async function handleRemove(memberId: string) {
    setRemoving(memberId);
    try {
      const res = await fetch(`/api/calendar-events/${eventId}/travel/${memberId}`, {
        method: "DELETE",
      });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) {
        const msg = await parseErrorMessage(res, "Failed to remove");
        toast.error(msg);
        return;
      }
      setLocalMembers((prev) => (prev ?? fetchedMembers ?? []).filter((m) => m.id !== memberId));
    } catch {
      toast.error("Network error");
    } finally {
      setRemoving(null);
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm font-semibold">Travel Roster</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Who is traveling to this away event.
          </p>
        </div>
        {isStaff && (
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" disabled={loading}>
                <Plus className="size-3.5 mr-1.5" />
                Add
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2" align="end">
              <p className="text-xs font-medium text-muted-foreground px-1 pb-2">
                Sport roster — ★ = default traveler
              </p>
              <RosterPicker
                sportCode={sportCode}
                eventId={eventId}
                currentMemberIds={memberIds}
                onAdded={handleAdded}
                onClose={() => setPickerOpen(false)}
              />
            </PopoverContent>
          </Popover>
        )}
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => <Skeleton key={i} className="h-9 w-full rounded-lg" />)}
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Failed to load</AlertTitle>
            <AlertDescription className="mt-1">
              <Button variant="outline" size="sm" onClick={reload}>Retry</Button>
            </AlertDescription>
          </Alert>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2 text-center">
            No travelers added yet.
          </p>
        ) : (
          <div className="space-y-1.5">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar className="size-7 shrink-0">
                    {m.user.avatarUrl && (
                      <AvatarImage src={m.user.avatarUrl} alt={m.user.name} />
                    )}
                    <AvatarFallback className="text-xs font-medium">
                      {getInitials(m.user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm truncate">{m.user.name}</span>
                  <Badge variant="gray" className="text-[10px] h-4 px-1 shrink-0">
                    {m.user.role}
                  </Badge>
                </div>
                {isStaff && (
                  <button
                    onClick={() => handleRemove(m.id)}
                    disabled={removing === m.id}
                    className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50 shrink-0"
                    aria-label="Remove from travel roster"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
