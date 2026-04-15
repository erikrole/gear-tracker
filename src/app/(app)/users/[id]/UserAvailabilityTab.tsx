"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, AlertCircle } from "lucide-react";
import { useFetch } from "@/hooks/use-fetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { handleAuthRedirect, parseErrorMessage } from "@/lib/errors";

/* ── Types ─────────────────────────────────────────────── */

type AvailabilityBlock = {
  id: string;
  userId: string;
  dayOfWeek: number;
  startsAt: string;
  endsAt: string;
  label: string | null;
  semesterLabel: string | null;
  createdAt: string;
};

/* ── Constants ──────────────────────────────────────────── */

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${period}` : `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

/* ── Add Block Form ─────────────────────────────────────── */

type AddBlockFormProps = {
  userId: string;
  onAdded: (block: AvailabilityBlock) => void;
  onCancel: () => void;
};

function AddBlockForm({ userId, onAdded, onCancel }: AddBlockFormProps) {
  const [dayOfWeek, setDayOfWeek] = useState("1"); // Monday default
  const [startsAt, setStartsAt] = useState("09:00");
  const [endsAt, setEndsAt] = useState("11:00");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (startsAt >= endsAt) {
      toast.error("Start time must be before end time");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${userId}/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dayOfWeek: parseInt(dayOfWeek),
          startsAt,
          endsAt,
          label: label.trim() || undefined,
        }),
      });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) {
        const msg = await parseErrorMessage(res, "Failed to add block");
        toast.error(msg);
        return;
      }
      const json = await res.json();
      onAdded(json.data);
      toast.success("Availability block added");
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border rounded-lg p-4 bg-muted/30 space-y-4">
      <p className="text-sm font-medium">Add class / recurring block</p>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_1fr] gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Day</Label>
          <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAY_NAMES.map((name, i) => (
                <SelectItem key={i} value={String(i)}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Start</Label>
          <Input
            type="time"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="h-8 text-sm"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">End</Label>
          <Input
            type="time"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className="h-8 text-sm"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Label (optional)</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="CHEM 101"
            className="h-8 text-sm"
            maxLength={80}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Saving…" : "Add block"}
        </Button>
      </div>
    </form>
  );
}

/* ── Main Tab ───────────────────────────────────────────── */

export default function UserAvailabilityTab({
  userId,
  canEdit,
}: {
  userId: string;
  canEdit: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [localBlocks, setLocalBlocks] = useState<AvailabilityBlock[] | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const {
    data: fetchedBlocks,
    loading,
    error,
    reload,
  } = useFetch<AvailabilityBlock[]>({
    url: `/api/users/${userId}/availability`,
    returnTo: `/users/${userId}`,
    transform: (json) => (json as { data: AvailabilityBlock[] }).data,
  });

  // Sync local state when fetch refreshes
  const [prevFetched, setPrevFetched] = useState(fetchedBlocks);
  if (fetchedBlocks !== prevFetched) {
    setPrevFetched(fetchedBlocks);
    setLocalBlocks(null);
  }

  const blocks = localBlocks ?? fetchedBlocks ?? [];

  function handleAdded(block: AvailabilityBlock) {
    setLocalBlocks((prev) => {
      const base = prev ?? fetchedBlocks ?? [];
      return [...base, block].sort((a, b) =>
        a.dayOfWeek !== b.dayOfWeek
          ? a.dayOfWeek - b.dayOfWeek
          : a.startsAt.localeCompare(b.startsAt)
      );
    });
    setShowForm(false);
  }

  async function handleDelete(blockId: string) {
    setDeleting(blockId);
    try {
      const res = await fetch(`/api/users/${userId}/availability/${blockId}`, {
        method: "DELETE",
      });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) {
        const msg = await parseErrorMessage(res, "Failed to remove block");
        toast.error(msg);
        return;
      }
      setLocalBlocks((prev) => (prev ?? fetchedBlocks ?? []).filter((b) => b.id !== blockId));
      toast.success("Block removed");
    } catch {
      toast.error("Network error");
    } finally {
      setDeleting(null);
    }
  }

  // Group blocks by day of week
  const byDay = new Map<number, AvailabilityBlock[]>();
  for (const block of blocks) {
    const arr = byDay.get(block.dayOfWeek) ?? [];
    arr.push(block);
    byDay.set(block.dayOfWeek, arr);
  }

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="mt-4 space-y-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
      </div>
    );
  }

  /* ── Error ── */
  if (error) {
    return (
      <div className="mt-4">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Failed to load availability</AlertTitle>
          <AlertDescription className="flex items-center gap-3 mt-2">
            <Button variant="outline" size="sm" onClick={reload}>Retry</Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">Weekly Class Schedule</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Recurring blocks when this person is unavailable. Used to flag shift conflicts.
            </p>
          </div>
          {canEdit && !showForm && (
            <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
              <Plus className="size-3.5 mr-1.5" />
              Add block
            </Button>
          )}
        </CardHeader>

        <CardContent className="space-y-3">
          {showForm && (
            <AddBlockForm
              userId={userId}
              onAdded={handleAdded}
              onCancel={() => setShowForm(false)}
            />
          )}

          {blocks.length === 0 && !showForm ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No availability blocks set.
            </p>
          ) : (
            // Mon–Sun order (1..6, 0 last)
            [1, 2, 3, 4, 5, 6, 0].map((day) => {
              const dayBlocks = byDay.get(day);
              if (!dayBlocks?.length) return null;
              return (
                <div key={day} className="flex items-start gap-3">
                  <span className="text-xs font-semibold text-muted-foreground w-8 pt-1 shrink-0">
                    {DAY_SHORT[day]}
                  </span>
                  <div className="flex flex-wrap gap-1.5 flex-1">
                    {dayBlocks.map((block) => (
                      <div
                        key={block.id}
                        className="group flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-1 text-xs"
                      >
                        <span className="font-medium">
                          {formatTime(block.startsAt)}–{formatTime(block.endsAt)}
                        </span>
                        {block.label && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-0.5">
                            {block.label}
                          </Badge>
                        )}
                        {canEdit && (
                          <button
                            onClick={() => handleDelete(block.id)}
                            disabled={deleting === block.id}
                            className="ml-1 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                            aria-label="Remove block"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
