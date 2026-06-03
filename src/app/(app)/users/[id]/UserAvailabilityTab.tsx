"use client";

import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, CalendarPlusIcon, PencilIcon, PlusIcon, Trash2 } from "lucide-react";
import { useFetch } from "@/hooks/use-fetch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { handleAuthRedirect, parseErrorMessage, parseJsonSafely } from "@/lib/errors";
import { cn } from "@/lib/utils";

type AvailabilityKind = "WEEKLY" | "AD_HOC";

type AvailabilityBlock = {
  id: string;
  userId: string;
  kind?: AvailabilityKind;
  dayOfWeek: number | null;
  date: string | null;
  startsAt: string;
  endsAt: string;
  label: string | null;
  semesterLabel: string | null;
  semesterStartsOn: string | null;
  semesterEndsOn: string | null;
  createdAt: string;
  updatedAt?: string;
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function blockKind(block: AvailabilityBlock): AvailabilityKind {
  return block.kind ?? "WEEKLY";
}

function dateValue(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : "";
}

function formatTime(hhmm: string): string {
  const parts = hhmm.split(":").map(Number);
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${period}` : `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

function formatDate(value: string | null): string {
  if (!value) return "";
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function sortBlocks(blocks: AvailabilityBlock[]): AvailabilityBlock[] {
  return [...blocks].sort((a, b) => {
    if (blockKind(a) !== blockKind(b)) return blockKind(a) === "WEEKLY" ? -1 : 1;
    if (blockKind(a) === "AD_HOC") return dateValue(a.date).localeCompare(dateValue(b.date)) || a.startsAt.localeCompare(b.startsAt);
    const dayA = a.dayOfWeek ?? 7;
    const dayB = b.dayOfWeek ?? 7;
    return dayA !== dayB ? dayA - dayB : a.startsAt.localeCompare(b.startsAt);
  });
}

type AvailabilityFormProps = {
  userId: string;
  initial?: AvailabilityBlock | null;
  onSaved: (block: AvailabilityBlock) => void;
  onCancel: () => void;
};

function AvailabilityForm({ userId, initial, onSaved, onCancel }: AvailabilityFormProps) {
  const kindId = useId();
  const dayId = useId();
  const dateId = useId();
  const startId = useId();
  const endId = useId();
  const labelId = useId();
  const semesterId = useId();
  const semesterStartId = useId();
  const semesterEndId = useId();

  const [kind, setKind] = useState<AvailabilityKind>(blockKind(initial ?? ({ kind: "WEEKLY" } as AvailabilityBlock)));
  const [dayOfWeek, setDayOfWeek] = useState(String(initial?.dayOfWeek ?? 1));
  const [date, setDate] = useState(dateValue(initial?.date));
  const [startsAt, setStartsAt] = useState(initial?.startsAt ?? "09:00");
  const [endsAt, setEndsAt] = useState(initial?.endsAt ?? "11:00");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [semesterLabel, setSemesterLabel] = useState(initial?.semesterLabel ?? "");
  const [semesterStartsOn, setSemesterStartsOn] = useState(dateValue(initial?.semesterStartsOn));
  const [semesterEndsOn, setSemesterEndsOn] = useState(dateValue(initial?.semesterEndsOn));
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (startsAt >= endsAt) {
      toast.error("Start time must be before end time");
      return;
    }
    if (kind === "AD_HOC" && !date) {
      toast.error("Choose a date for the one-time conflict");
      return;
    }
    if (semesterStartsOn && semesterEndsOn && semesterStartsOn > semesterEndsOn) {
      toast.error("Semester end date must be on or after start date");
      return;
    }
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const res = await fetch(
        initial ? `/api/users/${userId}/availability/${initial.id}` : `/api/users/${userId}/availability`,
        {
          method: initial ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind,
            dayOfWeek: kind === "WEEKLY" ? Number(dayOfWeek) : null,
            date: kind === "AD_HOC" ? date : null,
            startsAt,
            endsAt,
            label: label.trim() || undefined,
            semesterLabel: semesterLabel.trim() || undefined,
            semesterStartsOn: semesterStartsOn || null,
            semesterEndsOn: semesterEndsOn || null,
          }),
        },
      );
      if (handleAuthRedirect(res)) return;
      if (!res.ok) {
        toast.error(await parseErrorMessage(res, "Could not save availability"));
        return;
      }
      const json = await parseJsonSafely<{ data?: AvailabilityBlock }>(res);
      if (!json?.data) {
        toast.error("Availability saved, but the response was incomplete. Refresh the profile.");
        return;
      }
      onSaved(json.data);
      toast.success(initial ? "Availability updated" : "Availability added");
    } catch {
      toast.error("Network error");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border bg-muted/30 p-4">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1fr]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={kindId} className="text-xs">Type</Label>
            <Select name="availability-kind" value={kind} onValueChange={(value) => setKind(value as AvailabilityKind)}>
              <SelectTrigger id={kindId} size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WEEKLY">Weekly class</SelectItem>
                <SelectItem value="AD_HOC">One-time conflict</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {kind === "WEEKLY" ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={dayId} className="text-xs">Day</Label>
              <Select name="availability-day" value={dayOfWeek} onValueChange={setDayOfWeek}>
                <SelectTrigger id={dayId} size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_NAMES.map((name, i) => (
                    <SelectItem key={i} value={String(i)}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={dateId} className="text-xs">Date</Label>
              <Input id={dateId} name="availability-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 text-sm" required />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={labelId} className="text-xs">Label</Label>
            <Input id={labelId} name="availability-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={kind === "WEEKLY" ? "COMM 201" : "Exam"} className="h-8 text-sm" maxLength={80} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1fr]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={startId} className="text-xs">Start</Label>
            <Input id={startId} name="availability-start" type="time" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="h-8 text-sm" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={endId} className="text-xs">End</Label>
            <Input id={endId} name="availability-end" type="time" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="h-8 text-sm" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={semesterId} className="text-xs">Semester label</Label>
            <Input id={semesterId} name="availability-semester-label" value={semesterLabel} onChange={(e) => setSemesterLabel(e.target.value)} placeholder="Fall 2026" className="h-8 text-sm" maxLength={40} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={semesterStartId} className="text-xs">Semester starts</Label>
            <Input id={semesterStartId} name="availability-semester-start" type="date" value={semesterStartsOn} onChange={(e) => setSemesterStartsOn(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={semesterEndId} className="text-xs">Semester ends</Label>
            <Input id={semesterEndId} name="availability-semester-end" type="date" value={semesterEndsOn} onChange={(e) => setSemesterEndsOn(e.target.value)} className="h-8 text-sm" />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "Saving..." : initial ? "Save changes" : "Add availability"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function BlockPill({
  block,
  canEdit,
  deleting,
  onEdit,
  onDelete,
}: {
  block: AvailabilityBlock;
  canEdit: boolean;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const kind = blockKind(block);
  const range = `${formatTime(block.startsAt)}-${formatTime(block.endsAt)}`;
  const semesterRange = [formatDate(block.semesterStartsOn), formatDate(block.semesterEndsOn)].filter(Boolean).join(" to ");

  return (
    <div className="group flex min-w-0 items-center gap-1 rounded-md border bg-muted/40 px-2 py-1 text-xs">
      <span className="font-medium tabular-nums">{range}</span>
      {block.label && <Badge variant="secondary" className="h-4 px-1 text-[10px]">{block.label}</Badge>}
      {block.semesterLabel && <Badge variant="gray" className="h-4 px-1 text-[10px]">{block.semesterLabel}</Badge>}
      {semesterRange && kind === "WEEKLY" && <span className="text-muted-foreground">{semesterRange}</span>}
      {canEdit && (
        <span className="ml-auto flex items-center gap-0.5">
          <Button type="button" variant="ghost" size="icon-xs" className="size-6 text-muted-foreground" onClick={onEdit} aria-label="Edit availability block">
            <PencilIcon className="size-3" />
          </Button>
          <Button type="button" variant="ghost" size="icon-xs" className="size-6 text-muted-foreground hover:text-destructive" onClick={onDelete} disabled={deleting} aria-label="Remove availability block">
            <Trash2 className={cn("size-3", deleting && "animate-pulse")} />
          </Button>
        </span>
      )}
    </div>
  );
}

export default function UserAvailabilityTab({
  userId,
  canEdit,
}: {
  userId: string;
  canEdit: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AvailabilityBlock | null>(null);
  const [localBlocks, setLocalBlocks] = useState<AvailabilityBlock[] | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const deletingRef = useRef(false);

  const {
    data: fetchedBlocks,
    loading,
    error,
    reload,
  } = useFetch<AvailabilityBlock[]>({
    url: `/api/users/${userId}/availability`,
    returnTo: `/users/${userId}`,
    transform: (json) => sortBlocks((json as { data: AvailabilityBlock[] }).data ?? []),
  });

  const [prevFetched, setPrevFetched] = useState(fetchedBlocks);
  if (fetchedBlocks !== prevFetched) {
    setPrevFetched(fetchedBlocks);
    setLocalBlocks(null);
  }

  const blocks = sortBlocks(localBlocks ?? fetchedBlocks ?? []);
  const weeklyBlocks = blocks.filter((block) => blockKind(block) === "WEEKLY");
  const adHocBlocks = blocks.filter((block) => blockKind(block) === "AD_HOC");

  function upsertBlock(block: AvailabilityBlock) {
    setLocalBlocks((prev) => sortBlocks([...(prev ?? fetchedBlocks ?? []).filter((b) => b.id !== block.id), block]));
    setShowForm(false);
    setEditing(null);
  }

  async function handleDelete(blockId: string) {
    if (deletingRef.current) return;
    deletingRef.current = true;
    setDeleting(blockId);
    try {
      const res = await fetch(`/api/users/${userId}/availability/${blockId}`, { method: "DELETE" });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) {
        toast.error(await parseErrorMessage(res, "Could not remove availability"));
        return;
      }
      setLocalBlocks((prev) => (prev ?? fetchedBlocks ?? []).filter((b) => b.id !== blockId));
      toast.success("Availability removed");
    } catch {
      toast.error("Network error");
    } finally {
      deletingRef.current = false;
      setDeleting(null);
    }
  }

  if (loading) {
    return (
      <div className="mt-4 flex flex-col gap-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Failed to load availability</AlertTitle>
          <AlertDescription className="mt-2 flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={reload}>Retry</Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
          <div>
            <CardTitle className="text-sm font-semibold">Availability</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Class schedules and one-time conflicts warn staff during assignment. Staff still sets the final call window.
            </p>
          </div>
          {canEdit && !showForm && !editing && (
            <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
              <PlusIcon className="size-3.5" />
              Add
            </Button>
          )}
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {showForm && (
            <AvailabilityForm
              userId={userId}
              onSaved={upsertBlock}
              onCancel={() => setShowForm(false)}
            />
          )}
          {editing && (
            <AvailabilityForm
              userId={userId}
              initial={editing}
              onSaved={upsertBlock}
              onCancel={() => setEditing(null)}
            />
          )}

          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Badge variant="blue" size="sm">Weekly</Badge>
              <h3 className="text-sm font-medium">Semester class schedule</h3>
            </div>
            {weeklyBlocks.length === 0 ? (
              <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
                No weekly class blocks set.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {[1, 2, 3, 4, 5, 6, 0].map((day) => {
                  const dayBlocks = weeklyBlocks.filter((block) => block.dayOfWeek === day);
                  if (!dayBlocks.length) return null;
                  return (
                    <div key={day} className="flex items-start gap-3">
                      <span className="w-8 shrink-0 pt-1 text-xs font-semibold text-muted-foreground">
                        {DAY_SHORT[day]}
                      </span>
                      <div className="flex flex-1 flex-wrap gap-1.5">
                        {dayBlocks.map((block) => (
                          <BlockPill
                            key={block.id}
                            block={block}
                            canEdit={canEdit}
                            deleting={deleting === block.id}
                            onEdit={() => setEditing(block)}
                            onDelete={() => handleDelete(block.id)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Badge variant="orange" size="sm">Ad hoc</Badge>
              <h3 className="text-sm font-medium">One-time conflicts</h3>
            </div>
            {adHocBlocks.length === 0 ? (
              <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
                No one-time conflicts set.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {adHocBlocks.map((block) => (
                  <div key={block.id} className="flex items-start gap-3">
                    <span className="w-24 shrink-0 pt-1 text-xs font-semibold text-muted-foreground">
                      {formatDate(block.date)}
                    </span>
                    <div className="flex flex-1 flex-wrap gap-1.5">
                      <BlockPill
                        block={block}
                        canEdit={canEdit}
                        deleting={deleting === block.id}
                        onEdit={() => setEditing(block)}
                        onDelete={() => handleDelete(block.id)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </CardContent>
      </Card>

      {canEdit && !showForm && !editing && (
        <Button variant="outline" className="w-fit" onClick={() => setShowForm(true)}>
          <CalendarPlusIcon className="size-4" />
          Add availability
        </Button>
      )}
    </div>
  );
}
